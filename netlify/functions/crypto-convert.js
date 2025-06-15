const axios = require('axios');

// Oppslagstabell for CoinGecko-navn
const COINGECKO_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
};

exports.handler = async (event) => {
  const { crypto, fiat, date } = event.queryStringParameters;

  if (!crypto || !fiat || !date) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Mangler parameter: crypto, fiat eller date' })
    };
  }

  // Finn riktig CoinGecko-id
  const coinId = COINGECKO_IDS[crypto.toUpperCase()];
  if (!coinId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Ukjent krypto-symbol: ${crypto}` })
    };
  }

  try {
    // CoinGecko krever format dd-mm-yyyy
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/history?date=${date.split('-').reverse().join('-')}`;
    const res = await axios.get(url);

    // CoinGecko gir kursen i valgt fiat under market_data.current_price
    const price = res.data?.market_data?.current_price?.[fiat.toLowerCase()];
    if (!price) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Fant ikke kurs for ${crypto} til ${fiat} på ${date}` })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rate: price,
        date: date
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}; 