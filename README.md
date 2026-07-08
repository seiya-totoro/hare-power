# 晴れパワー送信機

2人だけで遊ぶスマホ向けのミニWebアプリです。

- 送る側URL: `index.html?role=sender&room=秘密ID`
- 受け取る側URL: `index.html?role=receiver&room=秘密ID`

同じ `room` のURLを開いた2人だけが、同じ晴れパワーと返信を見られます。URLを知っている人だけが開ける仕組みなので、SNSに公開せずLINEやInstagram DMで直接送ってください。

## できること

- 送る側が「相手の名前」「億晴れパワー」「メッセージ」を送信
- 受け取る側に、届いた数値とメッセージを表示
- 受け取る側が返信メッセージを送信
- 送る側に返信を表示
- 送信履歴と返信履歴を表示
- Firebase未設定でも、同じブラウザ内のデモ保存で画面確認可能

## なぜFirebaseが必要？

GitHub PagesはHTML/CSS/JavaScriptを置く場所としては使えますが、2台のスマホ間でデータを保存・同期するサーバー機能はありません。

このアプリでは無料枠で始めやすい Firebase Realtime Database を使います。

## Firebase設定手順

Firebaseの画面は少しずつ変わることがありますが、基本の流れは次の順番です。

### 1. Firebaseプロジェクトを作る

1. [Firebase console](https://console.firebase.google.com/) を開く
2. Googleアカウントでログインする
3. 画面中央か右上付近にある「プロジェクトを追加」または「Create a project」を押す
4. 「プロジェクト名」に好きな名前を入れる
   - 例: `hare-power`
5. 「続行」を押す
6. 「Google アナリティクス」は、このアプリでは使わないのでオフでOK
7. 「プロジェクトを作成」を押す
8. 完了画面が出たら「続行」を押す

ここまでで、Firebaseのプロジェクトトップ画面に入れます。

### 2. Webアプリを追加する

1. プロジェクトトップ画面の中央あたりにあるアプリ追加アイコンを探す
2. `</>` のWebアイコンを押す
   - iOSやAndroidのアイコンではなく、`</>` がWebアプリです
3. 「アプリのニックネーム」に好きな名前を入れる
   - 例: `hare-power-web`
4. 「Firebase Hostingも設定しますか？」のチェックは、今回は入れなくてOK
5. 「アプリを登録」を押す
6. `firebaseConfig` というコードが表示されるので、あとで使います

表示されるコードはだいたい次のような形です。

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

この画面は閉じずに置いておくと楽です。

### 3. Realtime Databaseを作る

1. Firebase画面の左側メニューを見る
2. 「構築」または「Build」を押す
3. その中の「Realtime Database」を押す
   - 「Firestore Database」と間違えないようにしてください
   - 今回使うのは「Realtime Database」です
4. 「データベースを作成」を押す
5. ロケーションを選ぶ画面では、近そうな場所を選ぶ
   - 日本なら `asia-southeast1` などアジア圏があればそれでOK
   - 迷ったら最初に表示された候補でも大丈夫です
6. セキュリティルールの画面では、最初は「テストモードで開始」を選ぶ
7. 「有効にする」を押す

作成後、Realtime Databaseの画面に移動します。

### 4. `script.js` に設定を貼る

`script.js` の一番上にある `firebaseConfig` を、Firebase画面で表示された内容に置き換えます。

このファイルです。

```text
script.js
```

置き換える場所は、ファイルの一番上、1行目から9行目あたりです。

今はこうなっています。

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Firebase画面に表示された `firebaseConfig` をコピーして、この `const firebaseConfig = { ... };` の部分だけをまるごと貼り替えてください。

貼り替え後は、例えばこういう形になります。

```js
const firebaseConfig = {
  apiKey: "AIzaSyExampleExample",
  authDomain: "hare-power.firebaseapp.com",
  databaseURL: "https://hare-power-default-rtdb.firebaseio.com",
  projectId: "hare-power",
  storageBucket: "hare-power.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

注意点:

- `const firebaseConfig = {` から `};` までを置き換える
- その下にある `const FIREBASE_SDK_VERSION = "10.12.5";` は消さない
- `databaseURL` が入っていることを必ず確認する
- `YOUR_API_KEY` や `YOUR_PROJECT_ID` が残っていたら、まだ貼り替えできていません
- Firebaseのコードに `measurementId` が入っていても、そのままでOKです

### 5. ルールを設定する

Realtime Databaseを作ったあと、読み書きできるようにルールを設定します。

1. Firebaseの左メニューから「構築」→「Realtime Database」を開く
2. 上のタブから「ルール」を押す
   - 「データ」「ルール」「バックアップ」などのタブが並んでいます
3. ルール入力欄にある内容を一度選択して、次の内容に置き換える
4. 「公開」または「Publish」を押す

```json
{
  "rules": {
    "rooms": {
      "$room": {
        ".read": "$room.length >= 16 && $room.length <= 48",
        ".write": "$room.length >= 16 && $room.length <= 48"
      }
    }
  }
}
```

これは「秘密の `room` IDを知っている人だけが、その部屋を読んだり書いたりできる」くらいの簡易ルールです。強い本人確認ではないので、URLは公開しないでください。

ルールを公開すると、Firebase側の準備は完了です。

### 6. GitHub Pagesに置く

1. GitHubのリポジトリに `index.html` / `style.css` / `script.js` / `README.md` を置く
2. GitHubの Settings → Pages を開く
3. Branchを選んで公開
4. 公開URLを開く

最初に送る側URLを開くと、自動で `room` 付きURLになります。画面に出る「受け取る側URL」をコピーして相手に送ればOKです。

## Firebase設定後の確認方法

1. 公開したURLを開く
2. 画面上部のステータスが「Firebaseに接続中です」になっているか見る
3. 送る側画面で、相手の名前、億晴れパワー、メッセージを入力して送る
4. 「受け取る側URL」をコピーして、別のブラウザやスマホで開く
5. 受け取る側に送信内容が表示されるか確認する
6. 受け取る側から返信して、送る側に表示されるか確認する

もし「Firebase未設定のため、この端末だけのデモ保存で動いています」と出る場合は、`script.js` の `firebaseConfig` に `YOUR_...` が残っている可能性が高いです。

## 使い方

1. 送る側が `index.html?role=sender&room=秘密ID` を開く
2. 「受け取る側URL」をコピーして相手に送る
3. 送る側が晴れパワーとメッセージを送信
4. 受け取る側が返信する
5. 送る側の「相手からの返信」に表示される

## 参考

- Firebase Webアプリの追加: https://firebase.google.com/docs/web/setup
- Realtime Database Web SDK: https://firebase.google.com/docs/database/web/start
- Realtime Database Security Rules: https://firebase.google.com/docs/database/security
