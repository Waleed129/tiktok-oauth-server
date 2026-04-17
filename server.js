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
  res.send('TikTok OAuth server is running.');
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
      return res.status(400).send(`TikTok error: ${error}${error_description ? ` - ${error_description}` : ''}`);
    }

    if (!code || !state) {
      return res.status(400).send('Missing code or state.');
    }

    if (!pendingStates.has(state)) {
      return res.status(400).send('Invalid or expired state.');
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
      console.error(data);
      return res.status(400).json(data);
    }

    console.log('open_id:', data.open_id);
    console.log('access_token:', data.access_token);
    console.log('refresh_token:', data.refresh_token);
    console.log('scope:', data.scope || scopes);

    return res.send('تم ربط TikTok بنجاح. ارجع للديسكورد.');
  } catch (err) {
    console.error(err);
    return res.status(500).send('Internal server error.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started on port ${PORT}`);
});