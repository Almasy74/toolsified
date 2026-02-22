const axios = require('axios');

exports.handler = async function (event, context) {
  const { crypto, fiat, date } = event.queryStringParameters;

  if (!crypto || !fiat || !date) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required parameters' })
    };
  }

  try {
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    const isToday = selectedDate.getTime() === today.getTime();
    const timestamp = Math.floor(selectedDate.getTime() / 1000);

    // Hent kryptokurs i USD
    let usdRate;
    if (isToday) {
      const response = await axios.get(`https://min-api.cryptocompare.com/data/price?fsym=${crypto}&tsyms=USD`);
      usdRate = response.data.USD;
    } else {
      const response = await axios.get(`https://min-api.cryptocompare.com/data/pricehistorical?fsym=${crypto}&tsyms=USD&ts=${timestamp}`);
      usdRate = response.data[crypto]?.USD;
    }

    if (!usdRate) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Crypto rate not found' })
      };
    }

    // Hvis vi trenger NOK eller EUR, konverter fra USD
    if (fiat === 'NOK' || fiat === 'EUR') {
      let fxRate;
      if (isToday) {
        const response = await axios.get(`https://api.frankfurter.dev/v1/latest?base=USD&symbols=${fiat}`);
        fxRate = response.data.rates[fiat];
      } else {
        // Frankfurter generally uses YYYY-MM-DD
        const dateStr = selectedDate.toISOString().split('T')[0];
        const response = await axios.get(`https://api.frankfurter.dev/v1/${dateStr}?base=USD&symbols=${fiat}`);
        fxRate = response.data.rates[fiat];
      }

      if (!fxRate) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Exchange rate not found' })
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          rate: usdRate * fxRate,
          date: date
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        rate: usdRate,
        date: date
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 