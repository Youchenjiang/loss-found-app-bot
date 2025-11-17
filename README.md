# Loss Found App Bot

一個具備「判斷—選擇—執行」流程的 Discord Bot。它會讀懂每則訊息、先判斷是否值得互動，再決定要不要回覆或僅以表情符號回應。

## Setup

1. **Create a `.env` file:**
    在專案根目錄建立 `.env`，並加入以下環境變數：

    ```javascript
    TOKEN=YOUR_BOT_TOKEN
    CLIENT_ID=YOUR_CLIENT_ID
    GUILD_ID=YOUR_GUILD_ID
    REACTION_EMOJI=OPTIONAL_CUSTOM_EMOJI
    OPENAI_API_KEY=YOUR_OPENAI_KEY
    OPENAI_BASE_URL=https://api.chatanywhere.tech/v1 # optional，未填則使用官方端點
    OPENAI_MODEL=gpt-4o-mini # optional，自訂模型名稱
    ```

2. **Install dependencies:**

    ```bash
    npm install
    ```

3. **Run the bot:**

    ```bash
    npm start
    ```

## How The Bot Decides

- **AI 判斷互動條件**：Bot 將訊息內容送往 OpenAI，模型根據系統提示輸出 JSON，決定是要 `reply`、`reaction` 或 `ignore`。
- **回覆流程**：當輸出 `{"action":"reply","replyText":"..."}` 時，Bot 會以繁體中文回覆，內容由模型依照當前語境產生。
- **表情流程**：若輸出 `{"action":"reaction"}`，Bot 只會按表情，可由模型指定 `reaction` 欄位，否則使用 `REACTION_EMOJI`（預設 👍）。
- **忽略流程**：若輸出 `{"action":"ignore"}`，Bot 將完全不動作，避免打擾無關對話。
- **安全退回機制**：若未設定 `OPENAI_API_KEY` 或 AI 呼叫失敗，Bot 會回到舊行為——偵測 `lfa` 關鍵字回覆，否則按預設表情。

可參考 [取得 OpenAI API](https://github.com/chatanywhere/GPT_API_free) 與 [串接教學](https://www.newspiggy.com/post/how-to-set-openai-chatgpt-api) 設定 `OPENAI_*` 參數。
