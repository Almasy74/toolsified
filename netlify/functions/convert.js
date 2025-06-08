const axios = require('axios');

exports.handler = async (event) => {
  const { from, to, amount } = event.queryStringParameters;

  console.log("Input params:", { from, to, amount });

  try {
    const url = `https://api.exchangerate.host/convert?from=${from}&to=${to}&amount=${amount}`;
    console.log("Fetching:", url);

    const res = await axios.get(url);
    console.log("API response:", res.data);

    if (!res.data || typeof res.data.result !== 'number') {
      throw new Error("Unexpected API response format");
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        result: res.data.result,
        date: res.data.date
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
