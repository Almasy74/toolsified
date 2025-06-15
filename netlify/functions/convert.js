const axios = require('axios');

exports.handler = async (event) => {
  const { from, to, amount } = event.queryStringParameters;

  try {
    const url = `https://open.er-api.com/v6/latest/${from}`;
    const res = await axios.get(url);

    if (!res.data || !res.data.rates[to]) {
      throw new Error("Invalid response or unknown currency");
    }

    const rate = res.data.rates[to];
    const result = parseFloat(amount) * rate;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        result,
        date: res.data.time_last_update_utc
      })
    };
  } catch (error) {
    console.error("Error:", error.message);
    return {
      statusCode: 500,
      body: `Error retrieving exchange rate: ${error.message}`
    };
  }
};

