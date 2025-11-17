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
    LOW_EMOTION_REPLY=自訂的鼓勵訊息（optional）
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

- **AI 指令格式**：模型只會輸出幾個用逗號分隔的 `KEY|VALUE` 指令，例如 `react|👍, reply|記得好好休息` 或 `action|ignore`。`KEY` 可以是 `react`/`reaction`/`emoji`、`reply`/`message`/`text`、`action`/`mode` 等。
- **完全交給 AI 判斷**：Bot 只解析這些指令並執行。`reply|...` 會觸發訊息回覆、`react|...` 會按對應表情、同時出現則依序完成兩種動作。若輸出 `action|ignore` 則保持沉默。
- **情緒映射**：若 AI 僅輸出 `emoji|sad` 或 `react|bad` 這類關鍵字，Bot 會自動轉成預設的悲傷表情；使用 `good/positive/happy` 等字樣則會轉成讚或笑臉。
- **安全退回機制**：當未提供 OpenAI API 或呼叫失敗時，Bot 會啟動本地簡易判斷——偵測悲傷字詞就回覆 + 表情、偵測情緒符號就只按表情、否則忽略。`LOW_EMOTION_REPLY` 可自訂安撫語。

可參考 [取得 OpenAI API](https://github.com/chatanywhere/GPT_API_free) 與 [串接教學](https://www.newspiggy.com/post/how-to-set-openai-chatgpt-api) 設定 `OPENAI_*` 參數。
