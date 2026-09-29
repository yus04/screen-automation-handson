# screen-automation-handson

GitHub Copilot + Playwright (MCP) を使って、**手元の PDF / Excel の受発注ファイルに書かれた項目を、基幹システム風の Web アプリへ転記する作業を自動化する**ハンズオン用リポジトリです。

## 1. このプロジェクトでできること

- 3 種類のフォーマットの PDF、3 種類のフォーマットの Excel の受発注サンプルファイルを題材にする
- Azure Static Web Apps に公開した「SCM-CORE 受発注管理システム」(フロントエンドのみのモック) に転記する
- 入力 → **登録確認画面** → 登録確定 という実際の基幹システムに近い操作フローを Playwright で自動化する
- 登録されたデータはブラウザの `localStorage` に保存され、画面下部の一覧で確認できる

## 2. ディレクトリ構成

```
.
├── web/                       # 転記先の Web アプリ (静的ファイルのみ)
│   ├── index.html             # 入力画面 / 確認画面 / 完了画面 / 登録済み一覧
│   ├── styles.css             # 基幹システム風のスタイル
│   ├── app.js                 # バリデーション・画面遷移・localStorage 保存
│   └── staticwebapp.config.json
├── infra/
│   ├── main.bicep             # Azure Static Web Apps をプロビジョニングする Bicep
│   └── main.parameters.json
├── samples/
│   ├── pdf/                   # 受発注 PDF サンプル 3 件 (フォーマット違い)
│   └── excel/                 # 受発注 Excel サンプル 3 件 (フォーマット違い)
├── tools/
│   ├── generate_samples.py    # サンプルファイル生成スクリプト
│   └── requirements.txt
└── prompts/
    └── playwright-transcription-prompts.md  # Copilot に渡す転記プロンプト集
```

## 3. 転記対象の項目

| 項目           | 入力形式         | 必須 | Web アプリの要素 ID / name |
| -------------- | ---------------- | ---- | -------------------------- |
| 注文番号       | テキスト         | ●    | `orderNumber`              |
| 受注日         | 日付             | ●    | `orderDate`                |
| 取引先         | プルダウン       | ●    | `customerCode`             |
| 納品希望日     | 日付             |      | `deliveryDate`             |
| 商品コード     | プルダウン       | ●    | `productCode`              |
| 数量           | 数値             | ●    | `quantity`                 |
| 単価 (円)      | 数値             | ●    | `unitPrice`                |
| 通貨           | プルダウン       |      | `currency`                 |
| 支払条件       | プルダウン       | ●    | `paymentTerms`             |
| 出荷方法       | ラジオボタン     |      | `shippingMethod`           |
| 担当者名       | テキスト         |      | `picName`                  |
| 検収要否       | チェックボックス |      | `inspectionRequired`       |
| 備考           | テキストエリア   |      | `remarks`                  |

必須項目 (●) が未入力の場合は確認画面に進めず、項目ごとにエラーメッセージが表示されます。

## 4. サンプル受発注ファイル

| ファイル                       | フォーマットの特徴                                | 注文番号     |
| ------------------------------ | ------------------------------------------------- | ------------ |
| `samples/pdf/order-001.pdf`    | 一般的な 2 列レイアウトの注文書                   | PO-2026-0001 |
| `samples/pdf/order-002.pdf`    | 英語ラベル + 明細テーブル形式の Purchase Order    | PO-2026-0042 |
| `samples/pdf/order-003.pdf`    | FAX 送信票風の縦並びレイアウト                    | PO-2026-0117 |
| `samples/excel/order-101.xlsx` | 1 シート縦並びの注文書                            | PO-2026-0208 |
| `samples/excel/order-102.xlsx` | 「ヘッダ」「明細」の 2 シート構成 (英語ラベル)    | PO-2026-0233 |
| `samples/excel/order-103.xlsx` | 1 行 1 受注の横持ち受注一覧表 (略称ラベル)        | PO-2026-0290 |

フォーマットやラベルの表記は異なりますが、いずれのファイルにも「3. 転記対象の項目」の値がすべて含まれています。

### サンプルファイルを再生成する

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r tools/requirements.txt
python tools/generate_samples.py
```

## 5. Web アプリをローカルで動かす

```bash
# 任意の静的ファイルサーバーで web/ を配信します
python -m http.server 8000 --directory web
# => http://localhost:8000
```

操作フロー:

1. 入力画面 `[ORD-0100]` で必須項目・任意項目を入力
2. 「受発注データの登録」ボタン → 登録確認画面 `[ORD-0101]`
3. 内容を確認して「登録を確定する」ボタン → 登録完了画面 `[ORD-0102]`
4. 登録内容はブラウザの `localStorage` (キー: `scm-core.orders`) に保存され、画面下部の一覧に表示されます

## 6. Azure Static Web Apps へのデプロイ

### 6-1. 事前準備

```bash
az login
az account set --subscription "<サブスクリプションID>"
npm install -g @azure/static-web-apps-cli
```

### 6-2. リソースのプロビジョニング (Bicep)

```bash
# リソースグループの作成
az group create \
  --name rg-screen-automation-handson \
  --location japaneast

# Static Web Apps のプロビジョニング
az deployment group create \
  --resource-group rg-screen-automation-handson \
  --name main \
  --template-file infra/main.bicep \
  --parameters infra/main.parameters.json
```

> Static Web Apps のコントロールプレーンは限られたリージョンのみ対応しています。`main.parameters.json` の `location` には `eastasia` などを指定してください (リソースグループのリージョンとは別で問題ありません)。

デプロイ後、公開エンドポイントを取得します。

```bash
az deployment group show \
  --resource-group rg-screen-automation-handson \
  --name main \
  --query properties.outputs.defaultHostname.value -o tsv
```

### 6-3. コンテンツのデプロイ

```bash
# デプロイトークンを取得
SWA_TOKEN=$(az staticwebapp secrets list \
  --name swa-scm-core-handson \
  --resource-group rg-screen-automation-handson \
  --query properties.apiKey -o tsv)

# web/ ディレクトリを本番環境へデプロイ
swa deploy ./web --deployment-token "$SWA_TOKEN" --env production
```

デプロイが完了すると `https://<name>.azurestaticapps.net` でアプリが公開されます。

### 6-4. 後片付け

```bash
az group delete --name rg-screen-automation-handson --yes --no-wait
```

## 7. Playwright MCP で転記を自動化する

### 7-1. MCP サーバーの設定

VS Code の `.vscode/mcp.json` (またはお使いのクライアントの MCP 設定) に Playwright MCP を追加します。

```json
{
  "servers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

### 7-2. プロンプトの実行

[`prompts/playwright-transcription-prompts.md`](prompts/playwright-transcription-prompts.md) に、そのまま貼り付けて使えるプロンプトを用意しています。

- 基本プロンプト: PDF 1 件を転記して登録確定まで行う
- Excel 用プロンプト: ラベルの表記ゆれを対応表でマッピングして転記する
- 一括プロンプト: PDF 3 件 + Excel 3 件の計 6 件を連続で転記する
- 異常系プロンプト: 必須項目バリデーションの挙動を確認する

プロンプト内の `<エンドポイント>` は 6-2 で取得した Static Web Apps の URL に置き換えてください。

### 7-3. ハンズオンの進め方 (推奨)

1. まず手作業で 1 件登録し、画面の流れを把握する
2. 基本プロンプトで PDF 1 件の自動転記を実行し、確認画面での突合結果を確認する
3. Excel 用プロンプトでフォーマット差異への対応を確認する
4. 一括プロンプトで 6 件を自動登録し、一覧に 6 行並ぶことを確認する

## 8. 注意事項

- 本リポジトリの Web アプリはハンズオン用のモックで、バックエンドはありません。データはブラウザ内にのみ保存されます。
- サンプルの企業名・担当者名・取引内容はすべて架空のものです。
- 公開エンドポイントは誰でもアクセスできます。機密情報は入力しないでください。
