const express = require('express');
const crypto = require('crypto');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const PORT = process.env.PORT || 10000;
const BASE_URL = process.env.BASE_URL;
const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;

const pendingStates = new Map();

app.get('/', (req, res) => {
  res.send('OAuth server is running.');
});

app.get('/tiktok/connect', (req, res) => {
  const state = crypto.randomBytes(24).toString('hex');
  pendingStates.set(state, Date.now());

  const redirectUri = `${BASE_URL}/tiktok/callback`;
  const scope = 'user.info.basic,video.publish,video.upload';

  const authUrl =
    'https://www.tiktok.com/v2/auth/authorize/' +
    `?client_key=${encodeURIComponent(TIKTOK_CLIENT_KEY)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(authUrl);
});

app.get('/tiktok/callback', async (req, res) => {
  try {
    const { code, state, error, error_description, scopes } = req.query;

    if (error) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Connection Failed</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: Arial, sans-serif;
              background: #0a0a0f;
              color: #ffffff;
            }

            .box {
              width: min(520px, calc(100% - 32px));
              padding: 28px;
              border-radius: 18px;
              background: #12121a;
              border: 1px solid #232335;
              text-align: center;
            }

            h1 {
              margin: 0 0 12px;
              color: #fe2c55;
            }

            p {
              color: #d8d8e8;
              line-height: 1.7;
            }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>Connection failed</h1>
            <p>${error}${error_description ? ` - ${error_description}` : ''}</p>
          </div>
        </body>
        </html>
      `);
    }

    if (!code || !state) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Missing Authorization Data</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: Arial, sans-serif;
              background: #0a0a0f;
              color: #ffffff;
            }

            .box {
              width: min(520px, calc(100% - 32px));
              padding: 28px;
              border-radius: 18px;
              background: #12121a;
              border: 1px solid #232335;
              text-align: center;
            }

            h1 {
              margin: 0 0 12px;
              color: #fe2c55;
            }

            p {
              color: #d8d8e8;
              line-height: 1.7;
            }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>Missing authorization data</h1>
            <p>The authorization response is missing a code or state value. Please try connecting again.</p>
          </div>
        </body>
        </html>
      `);
    }

    if (!pendingStates.has(state)) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Invalid State</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: Arial, sans-serif;
              background: #0a0a0f;
              color: #ffffff;
            }

            .box {
              width: min(520px, calc(100% - 32px));
              padding: 28px;
              border-radius: 18px;
              background: #12121a;
              border: 1px solid #232335;
              text-align: center;
            }

            h1 {
              margin: 0 0 12px;
              color: #fe2c55;
            }

            p {
              color: #d8d8e8;
              line-height: 1.7;
            }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>Invalid or expired session</h1>
            <p>The connection session is invalid or expired. Please return to the website and click Connect account again.</p>
          </div>
        </body>
        </html>
      `);
    }

    pendingStates.delete(state);

    const body = new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY,
      client_secret: TIKTOK_CLIENT_SECRET,
      code: String(code),
      grant_type: 'authorization_code',
      redirect_uri: `${BASE_URL}/tiktok/callback`
    });

    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache'
      },
      body: body.toString()
    });

    const data = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('OAuth token exchange failed:', data);

      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Token Exchange Failed</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: Arial, sans-serif;
              background: #0a0a0f;
              color: #ffffff;
            }

            .box {
              width: min(520px, calc(100% - 32px));
              padding: 28px;
              border-radius: 18px;
              background: #12121a;
              border: 1px solid #232335;
              text-align: center;
            }

            h1 {
              margin: 0 0 12px;
              color: #fe2c55;
            }

            p {
              color: #d8d8e8;
              line-height: 1.7;
            }

            code {
              display: block;
              margin-top: 14px;
              padding: 12px;
              border-radius: 10px;
              background: #171722;
              color: #ffffff;
              text-align: left;
              white-space: pre-wrap;
              overflow-wrap: anywhere;
            }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>Connection failed</h1>
            <p>The authorization code could not be exchanged for access credentials.</p>
            <code>${JSON.stringify(data, null, 2)}</code>
          </div>
        </body>
        </html>
      `);
    }

    console.log('open_id:', data.open_id);
    console.log('scope:', data.scope || scopes);
    console.log('TikTok account connected successfully.');

    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Account Connected</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
            background: #0a0a0f;
            color: #ffffff;
          }

          .box {
            width: min(560px, calc(100% - 32px));
            padding: 32px;
            border-radius: 18px;
            background: #12121a;
            border: 1px solid #232335;
            text-align: center;
          }

          .check {
            width: 54px;
            height: 54px;
            margin: 0 auto 18px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #23c483;
            color: #ffffff;
            font-size: 30px;
            font-weight: bold;
          }

          h1 {
            margin: 0 0 12px;
            font-size: 28px;
          }

          p {
            color: #d8d8e8;
            line-height: 1.7;
            margin: 0;
          }

          .hint {
            margin-top: 16px;
            color: #9a9ab3;
            font-size: 14px;
          }

          a {
            color: #fe2c55;
            text-decoration: none;
          }

          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>

      <body>
        <div class="box">
          <div class="check">✓</div>
          <h1>Account connected successfully.</h1>
          <p>Return to Discord and submit a video request through the bot.</p>
          <p class="hint">
            The connected account can now be used by the authorized publishing workflow after moderator review.
          </p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);

    return res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Server Error</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
            background: #0a0a0f;
            color: #ffffff;
          }

          .box {
            width: min(520px, calc(100% - 32px));
            padding: 28px;
            border-radius: 18px;
            background: #12121a;
            border: 1px solid #232335;
            text-align: center;
          }

          h1 {
            margin: 0 0 12px;
            color: #fe2c55;
          }

          p {
            color: #d8d8e8;
            line-height: 1.7;
          }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>Internal server error</h1>
          <p>An unexpected error occurred while connecting the account. Please try again later.</p>
        </div>
      </body>
      </html>
    `);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started on port ${PORT}`);
});
