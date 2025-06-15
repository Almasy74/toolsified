const axios = require('axios');

exports.handler = async (event) => {
  const { crypto, fiat, date } = event.queryStringParameters;

  if (!crypto || !fiat || !date) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Mangler parameter: crypto, fiat eller date' })
    };
  }

  try {
    // CoinGecko krever format yyyy-mm-dd
    const url = `https://api.coingecko.com/api/v3/coins/${crypto.toLowerCase()}/history?date=${date.split('-').reverse().join('-')}`;
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