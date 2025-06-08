const axios = require('axios');

exports.handler = async (event) => {
  const { from, to, amount } = event.queryStringParameters;

  try {
    const url = `https://api.exchangerate.host/convert?from=${from}&to=${to}&amount=${amount}`;
    console.log(`Fetching: ${url}`);

    const res = await axios.get(url);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(res.data)
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Error retrieving exchange rate',
        details: e.message || e.toString()
      })
    };
  }
};

