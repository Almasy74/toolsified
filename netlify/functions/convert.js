const axios = require('axios');

exports.handler = async (event) => {
  const { from, to, amount, date } = event.queryStringParameters;

  try {
    let url;
    if (date) {
      // Hent historisk kurs
      url = `https://api.exchangerate.host/${date}?base=${from}&symbols=${to}`;
    } else {
      // Hent dagens kurs
      url = `https://api.exchangerate.host/latest?base=${from}&symbols=${to}`;
    }
    const res = await axios.get(url);

    if (!res.data || !res.data.rates || !res.data.rates[to]) {
      throw new Error("Invalid response or unknown currency");
    }

    const rate = res.data.rates[to];
    const result = parseFloat(amount) * rate;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        result,
        date: date || res.data.date
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

