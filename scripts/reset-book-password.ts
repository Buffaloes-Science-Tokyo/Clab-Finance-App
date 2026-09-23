/**
 * 最終手段: 口座のパスワードをコマンドから再設定する(リカバリーコードも分からない場合)。
 *   npm run book:reset-password
 * このPCとプロジェクトのフォルダを操作できる人だけが実行できる。
 */
import "dotenv/config";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { listBooks, forceResetBookPassword, MIN_PASSWORD_LENGTH } from "@/server/books";

async function main() {
  const books = listBooks();
  if (books.length === 0) {
    console.log("口座がありません。");
    return;
  }
  console.log("口座の一覧:");
  books.forEach((b, i) => console.log(`  ${i + 1}. ${b.name}`));

  // 入力を1行ずつ読む(パイプで渡された入力も取りこぼさないよう、イテレーターで読む)
  const rl = createInterface({ input: stdin, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (prompt: string) => {
    stdout.write(prompt);
    const { value, done } = await lines.next();
    if (done) throw new Error("入力が途中で終わりました。");
    return String(value);
  };
  try {
    const answer = (await ask("\n再設定する口座の番号または名前: ")).trim();
    const byNumber = books[Number(answer) - 1];
    const name = byNumber ? byNumber.name : answer;

    const password = await ask(`新しいパスワード(${MIN_PASSWORD_LENGTH}文字以上): `);
    const confirm = await ask("新しいパスワード(確認): ");
    if (password !== confirm) throw new Error("確認用のパスワードが一致しません。");

    const { book, recoveryCode } = forceResetBookPassword(name, password);
    console.log(`\n口座「${book.name}」のパスワードを再設定しました。`);
    console.log(`新しいリカバリーコード: ${recoveryCode}`);
    console.log("(以前のリカバリーコードは無効になりました。このコードを控えてください)");
    console.log("\n※ 画面に入力したパスワードが表示されたままの場合は、ターミナルを閉じてください。");
  } finally {
    rl.close();
  }
}

main().catch((e) => {
  console.error(`エラー: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
