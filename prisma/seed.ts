import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const dbFile = dbUrl.replace(/^file:/, "");
const adapter = new PrismaBetterSqlite3({
  url: `file:${path.resolve(process.cwd(), dbFile)}`,
});
const prisma = new PrismaClient({ adapter });

function monthsAgo(n: number, day = 10) {
  const d = new Date();
  d.setDate(day);
  d.setMonth(d.getMonth() - n);
  return d;
}

async function main() {
  console.log("シードデータを投入します...");

  // ── クラブ設定 ──────────────────────
  await prisma.clubSetting.upsert({
    where: { id: "singleton" },
    update: { poolFundTarget: 50000, roundTo: 100 },
    create: { id: "singleton", poolFundTarget: 50000, roundTo: 100 },
  });

  // ── カテゴリ ────────────────────────
  const categoryDefs = [
    { name: "部費", type: "INCOME" as const },
    { name: "寄付", type: "INCOME" as const },
    { name: "その他収入", type: "INCOME" as const },
    { name: "施設費", type: "EXPENSE" as const },
    { name: "備品費", type: "EXPENSE" as const },
    { name: "遠征費", type: "EXPENSE" as const },
    { name: "交際費", type: "EXPENSE" as const },
    { name: "その他支出", type: "EXPENSE" as const },
  ];
  const categories: Record<string, { id: string }> = {};
  for (const def of categoryDefs) {
    categories[def.name] = await prisma.category.upsert({
      where: { name: def.name },
      update: { type: def.type },
      create: def,
    });
  }

  // ── 仮想口座 ────────────────────────
  const accountDefs = [
    { name: "部", note: "部の通常運営費" },
    { name: "寄付", note: "OB・保護者からの寄付金" },
    { name: "イヤーブック", note: "イヤーブック制作費" },
  ];
  const accounts: Record<string, { id: string }> = {};
  for (const def of accountDefs) {
    accounts[def.name] = await prisma.virtualAccount.upsert({
      where: { name: def.name },
      update: {},
      create: def,
    });
  }

  // ── 部費内訳項目 ──────────────────────
  const duesItemDefs = [
    { name: "基本部費", amount: 3000, categoryId: categories["部費"].id },
    { name: "施設費", amount: 1000, categoryId: categories["部費"].id },
    { name: "備品積立", amount: 500, categoryId: categories["部費"].id },
  ];
  const existingDuesItems = await prisma.duesItem.findMany();
  if (existingDuesItems.length === 0) {
    for (const def of duesItemDefs) {
      await prisma.duesItem.create({ data: def });
    }
  }
  const duesItems = await prisma.duesItem.findMany({ where: { isActive: true } });

  // ── 部員 ───────────────────────────
  const memberDefs = [
    { name: "佐藤 健太", period: "50期", type: "STAFF" as const },
    { name: "鈴木 大輔", period: "51期", type: "PLAYER" as const },
    { name: "高橋 美咲", period: "51期", type: "PLAYER" as const },
    { name: "田中 蓮", period: "52期", type: "PLAYER" as const },
    { name: "伊藤 陽菜", period: "52期", type: "PLAYER" as const },
    { name: "渡辺 翔太", period: "52期", type: "STUDENT_COACH" as const },
    { name: "山本 結衣", period: "53期", type: "PLAYER" as const },
    { name: "中村 優斗", period: "53期", type: "PLAYER" as const },
    { name: "小林 誠", period: "48期", type: "WORKING_ADULT" as const },
    { name: "加藤 真央", period: "49期", type: "WITHDRAWN" as const },
  ];

  const existingMembers = await prisma.member.findMany();
  let members = existingMembers;
  if (existingMembers.length === 0) {
    members = [];
    for (const def of memberDefs) {
      members.push(await prisma.member.create({ data: def }));
    }
  }

  const activeMembers = members.filter(
    (m) => m.type !== "WITHDRAWN" && m.type !== "OTHER"
  );

  // ── 過去3ヶ月分の部費計上 + 入出金 + ツケ ──────
  const existingTx = await prisma.transaction.count();
  if (existingTx === 0 && duesItems.length > 0) {
    const totalDues = duesItems.reduce((s, i) => s + i.amount, 0);

    for (let monthOffset = 3; monthOffset >= 1; monthOffset--) {
      const chargeDate = monthsAgo(monthOffset, 5);
      const ym = `${chargeDate.getFullYear()}-${String(chargeDate.getMonth() + 1).padStart(2, "0")}`;

      for (const member of activeMembers) {
        const record = await prisma.memberDuesRecord.create({
          data: {
            memberId: member.id,
            yearMonth: ym,
            totalAmount: totalDues,
            items: {
              create: duesItems.map((item) => ({
                duesItemId: item.id,
                name: item.name,
                amount: item.amount,
              })),
            },
          },
        });
        await prisma.memberLedgerEntry.create({
          data: {
            memberId: member.id,
            type: "DUES_CHARGE",
            amount: totalDues,
            description: `${ym} 部費`,
            date: chargeDate,
            duesRecordId: record.id,
          },
        });
      }

      // 大半の部員は月末に現金で支払う
      const payDate = monthsAgo(monthOffset, 25);
      for (const member of activeMembers.slice(0, activeMembers.length - 2)) {
        const tx = await prisma.transaction.create({
          data: {
            date: payDate,
            type: "INCOME",
            amount: totalDues,
            categoryId: categories["部費"].id,
            memberId: member.id,
            description: `${ym} 部費 入金`,
            method: "現金",
            virtualAccountId: accounts["部"].id,
          },
        });
        await prisma.memberLedgerEntry.create({
          data: {
            memberId: member.id,
            type: "PAYMENT",
            amount: -totalDues,
            description: `${ym} 部費 入金`,
            date: payDate,
            transactionId: tx.id,
          },
        });
      }

      // 部の支出
      await prisma.transaction.create({
        data: {
          date: monthsAgo(monthOffset, 15),
          type: "EXPENSE",
          amount: 18000,
          categoryId: categories["遠征費"].id,
          description: `${ym} 練習試合 交通費`,
          method: "現金",
          virtualAccountId: accounts["部"].id,
        },
      });
      await prisma.transaction.create({
        data: {
          date: monthsAgo(monthOffset, 8),
          type: "EXPENSE",
          amount: 6500,
          categoryId: categories["備品費"].id,
          description: `${ym} 消耗品購入`,
          method: "銀行振込",
          virtualAccountId: accounts["部"].id,
        },
      });
    }

    // 寄付金の受け入れと、その一部を部の遠征費へ振替
    await prisma.transaction.create({
      data: {
        date: monthsAgo(2, 12),
        type: "INCOME",
        amount: 50000,
        categoryId: categories["寄付"].id,
        description: "OB会より寄付",
        method: "銀行振込",
        virtualAccountId: accounts["寄付"].id,
      },
    });
    await prisma.virtualAccountTransfer.create({
      data: {
        date: monthsAgo(1, 1),
        amount: 20000,
        fromAccountId: accounts["寄付"].id,
        toAccountId: accounts["部"].id,
        description: "寄付金を遠征費に充当",
      },
    });

    // イヤーブック: 制作費を先払い(集金前のため残高はマイナス)
    await prisma.transaction.create({
      data: {
        date: monthsAgo(1, 20),
        type: "EXPENSE",
        amount: 30000,
        categoryId: categories["その他支出"].id,
        description: "イヤーブック印刷代 前金",
        method: "銀行振込",
        virtualAccountId: accounts["イヤーブック"].id,
      },
    });

    // 直近: 未払いのツケを数件作成(発生ベースと現金ベースの差を見せる)
    if (activeMembers.length >= 2) {
      await prisma.memberLedgerEntry.create({
        data: {
          memberId: activeMembers[activeMembers.length - 1].id,
          type: "TAB_CHARGE",
          amount: 800,
          description: "部室で飲料購入(ツケ)",
          date: monthsAgo(0, 3),
        },
      });
      await prisma.memberLedgerEntry.create({
        data: {
          memberId: activeMembers[activeMembers.length - 2].id,
          type: "TAB_CHARGE",
          amount: 1500,
          description: "テーピング購入(ツケ)",
          date: monthsAgo(0, 5),
        },
      });
    }
  }

  // ── 予算(今月・今四半期・今年) ──────────
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const q = Math.floor(now.getMonth() / 3) + 1;
  const quarter = `${now.getFullYear()}-Q${q}`;
  const year = `${now.getFullYear()}`;

  const budgetDefs: {
    periodType: "MONTH" | "QUARTER" | "YEAR";
    period: string;
    categoryName: string;
    plannedAmount: number;
  }[] = [
    { periodType: "MONTH", period: ym, categoryName: "部費", plannedAmount: activeMembers.length * 4500 },
    { periodType: "MONTH", period: ym, categoryName: "遠征費", plannedAmount: 20000 },
    { periodType: "MONTH", period: ym, categoryName: "備品費", plannedAmount: 8000 },
    { periodType: "QUARTER", period: quarter, categoryName: "遠征費", plannedAmount: 60000 },
    { periodType: "YEAR", period: year, categoryName: "遠征費", plannedAmount: 240000 },
  ];

  for (const def of budgetDefs) {
    const category = categories[def.categoryName];
    if (!category) continue;
    await prisma.budget.upsert({
      where: {
        periodType_period_categoryId: {
          periodType: def.periodType,
          period: def.period,
          categoryId: category.id,
        },
      },
      update: { plannedAmount: def.plannedAmount },
      create: {
        periodType: def.periodType,
        period: def.period,
        categoryId: category.id,
        plannedAmount: def.plannedAmount,
      },
    });
  }

  console.log("シード完了。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
