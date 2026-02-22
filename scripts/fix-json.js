const fs = require('fs');

try {
    const tzOld = [
        { "base": "America/Los_Angeles", "target": "America/New_York", "baseName": "Pacific Time (PT)", "targetName": "Eastern Time (ET)", "baseVar": "pst", "targetVar": "est" },
        { "base": "Europe/London", "target": "America/New_York", "baseName": "London (GMT/BST)", "targetName": "Eastern Time (ET)", "baseVar": "gmt", "targetVar": "est" },
        { "base": "Europe/Paris", "target": "America/New_York", "baseName": "Central European Time (CET)", "targetName": "Eastern Time (ET)", "baseVar": "cet", "targetVar": "est" },
        { "base": "Asia/Tokyo", "target": "America/Los_Angeles", "baseName": "Japan Standard Time (JST)", "targetName": "Pacific Time (PT)", "baseVar": "jst", "targetVar": "pst" },
        { "base": "America/New_York", "target": "Asia/Kolkata", "baseName": "Eastern Time (ET)", "targetName": "India Standard Time (IST)", "baseVar": "est", "targetVar": "ist" },
        { "base": "Australia/Sydney", "target": "America/Los_Angeles", "baseName": "Australian Eastern Time (AET)", "targetName": "Pacific Time (PT)", "baseVar": "aet", "targetVar": "pst" },
        { "base": "Europe/Berlin", "target": "Asia/Tokyo", "baseName": "Central European Time (CET)", "targetName": "Japan Standard Time (JST)", "baseVar": "cet", "targetVar": "jst" },
        { "base": "America/Chicago", "target": "Europe/London", "baseName": "Central Time (CT)", "targetName": "London (GMT/BST)", "baseVar": "ct", "targetVar": "gmt" },
        { "base": "Europe/Paris", "target": "Asia/Shanghai", "baseName": "Central European Time (CET)", "targetName": "China Standard Time (CST)", "baseVar": "cet", "targetVar": "cst" },
        { "base": "America/Denver", "target": "Europe/London", "baseName": "Mountain Time (MT)", "targetName": "London (GMT/BST)", "baseVar": "mt", "targetVar": "gmt" }
    ];

    const tzNew = [
        { "base": "America/Los_Angeles", "target": "Europe/London", "baseName": "Pacific Time (PT)", "targetName": "London (GMT/BST)", "baseVar": "pst", "targetVar": "gmt" },
        { "base": "Asia/Tokyo", "target": "America/New_York", "baseName": "Japan Standard Time (JST)", "targetName": "Eastern Time (ET)", "baseVar": "jst", "targetVar": "est" },
        { "base": "Australia/Sydney", "target": "America/New_York", "baseName": "Australian Eastern Time (AET)", "targetName": "Eastern Time (ET)", "baseVar": "aet", "targetVar": "est" },
        { "base": "Asia/Dubai", "target": "America/New_York", "baseName": "Gulf Standard Time (GST)", "targetName": "Eastern Time (ET)", "baseVar": "gst", "targetVar": "est" },
        { "base": "Asia/Singapore", "target": "America/Los_Angeles", "baseName": "Singapore Time (SGT)", "targetName": "Pacific Time (PT)", "baseVar": "sgt", "targetVar": "pst" },
        { "base": "Europe/London", "target": "Asia/Kolkata", "baseName": "London (GMT/BST)", "targetName": "India Standard Time (IST)", "baseVar": "gmt", "targetVar": "ist" },
        { "base": "America/Los_Angeles", "target": "Asia/Kolkata", "baseName": "Pacific Time (PT)", "targetName": "India Standard Time (IST)", "baseVar": "pst", "targetVar": "ist" },
        { "base": "Europe/Berlin", "target": "America/Los_Angeles", "baseName": "Central European Time (CET)", "targetName": "Pacific Time (PT)", "baseVar": "cet", "targetVar": "pst" },
        { "base": "Asia/Shanghai", "target": "America/New_York", "baseName": "China Standard Time (CST)", "targetName": "Eastern Time (ET)", "baseVar": "cst", "targetVar": "est" }
    ];

    fs.writeFileSync('./scripts/data-tz.json', JSON.stringify([...tzOld, ...tzNew], null, 4));
    console.log('TZ fixed');

    // Load original currency
    const currOld = [
        { "base": "USD", "target": "EUR", "baseName": "US Dollars", "targetName": "Euros" },
        { "base": "EUR", "target": "USD", "baseName": "Euros", "targetName": "US Dollars" },
        { "base": "GBP", "target": "USD", "baseName": "British Pounds", "targetName": "US Dollars" },
        { "base": "USD", "target": "GBP", "baseName": "US Dollars", "targetName": "British Pounds" },
        { "base": "USD", "target": "JPY", "baseName": "US Dollars", "targetName": "Japanese Yen" },
        { "base": "EUR", "target": "GBP", "baseName": "Euros", "targetName": "British Pounds" },
        { "base": "GBP", "target": "EUR", "baseName": "British Pounds", "targetName": "Euros" },
        { "base": "USD", "target": "CAD", "baseName": "US Dollars", "targetName": "Canadian Dollars" },
        { "base": "CAD", "target": "USD", "baseName": "Canadian Dollars", "targetName": "US Dollars" },
        { "base": "USD", "target": "AUD", "baseName": "US Dollars", "targetName": "Australian Dollars" },
        { "base": "AUD", "target": "USD", "baseName": "Australian Dollars", "targetName": "US Dollars" },
        { "base": "EUR", "target": "CHF", "baseName": "Euros", "targetName": "Swiss Francs" },
        { "base": "USD", "target": "CHF", "baseName": "US Dollars", "targetName": "Swiss Francs" },
        { "base": "EUR", "target": "JPY", "baseName": "Euros", "targetName": "Japanese Yen" },
        { "base": "EUR", "target": "NOK", "baseName": "Euros", "targetName": "Norwegian Kroner" },
        { "base": "NOK", "target": "EUR", "baseName": "Norwegian Kroner", "targetName": "Euros" },
        { "base": "USD", "target": "NOK", "baseName": "US Dollars", "targetName": "Norwegian Kroner" },
        { "base": "USD", "target": "SEK", "baseName": "US Dollars", "targetName": "Swedish Krona" },
        { "base": "EUR", "target": "SEK", "baseName": "Euros", "targetName": "Swedish Krona" },
        { "base": "USD", "target": "INR", "baseName": "US Dollars", "targetName": "Indian Rupees" }
    ];

    const currNew = [
        { "base": "INR", "target": "USD", "baseName": "Indian Rupees", "targetName": "US Dollars" },
        { "base": "JPY", "target": "USD", "baseName": "Japanese Yen", "targetName": "US Dollars" },
        { "base": "CHF", "target": "USD", "baseName": "Swiss Francs", "targetName": "US Dollars" },
        { "base": "CHF", "target": "EUR", "baseName": "Swiss Francs", "targetName": "Euros" },
        { "base": "GBP", "target": "AUD", "baseName": "British Pounds", "targetName": "Australian Dollars" },
        { "base": "AUD", "target": "GBP", "baseName": "Australian Dollars", "targetName": "British Pounds" },
        { "base": "EUR", "target": "CAD", "baseName": "Euros", "targetName": "Canadian Dollars" },
        { "base": "CAD", "target": "EUR", "baseName": "Canadian Dollars", "targetName": "Euros" },
        { "base": "EUR", "target": "AUD", "baseName": "Euros", "targetName": "Australian Dollars" },
        { "base": "AUD", "target": "EUR", "baseName": "Australian Dollars", "targetName": "Euros" },
        { "base": "USD", "target": "CNY", "baseName": "US Dollars", "targetName": "Chinese Yuan" },
        { "base": "CNY", "target": "USD", "baseName": "Chinese Yuan", "targetName": "US Dollars" },
        { "base": "USD", "target": "NZD", "baseName": "US Dollars", "targetName": "New Zealand Dollars" },
        { "base": "NZD", "target": "USD", "baseName": "New Zealand Dollars", "targetName": "US Dollars" },
        { "base": "USD", "target": "KRW", "baseName": "US Dollars", "targetName": "South Korean Won" },
        { "base": "KRW", "target": "USD", "baseName": "South Korean Won", "targetName": "US Dollars" },
        { "base": "USD", "target": "SGD", "baseName": "US Dollars", "targetName": "Singapore Dollars" },
        { "base": "SGD", "target": "USD", "baseName": "Singapore Dollars", "targetName": "US Dollars" },
        { "base": "USD", "target": "HKD", "baseName": "US Dollars", "targetName": "Hong Kong Dollars" },
        { "base": "HKD", "target": "USD", "baseName": "Hong Kong Dollars", "targetName": "US Dollars" },
        { "base": "GBP", "target": "CAD", "baseName": "British Pounds", "targetName": "Canadian Dollars" },
        { "base": "CAD", "target": "GBP", "baseName": "Canadian Dollars", "targetName": "British Pounds" },
        { "base": "EUR", "target": "DKK", "baseName": "Euros", "targetName": "Danish Kroner" },
        { "base": "DKK", "target": "EUR", "baseName": "Danish Kroner", "targetName": "Euros" },
        { "base": "USD", "target": "DKK", "baseName": "US Dollars", "targetName": "Danish Kroner" },
        { "base": "DKK", "target": "USD", "baseName": "Danish Kroner", "targetName": "US Dollars" },
        { "base": "SEK", "target": "USD", "baseName": "Swedish Krona", "targetName": "US Dollars" },
        { "base": "NOK", "target": "USD", "baseName": "Norwegian Kroner", "targetName": "US Dollars" },
        { "base": "USD", "target": "ZAR", "baseName": "US Dollars", "targetName": "South African Rand" },
        { "base": "ZAR", "target": "USD", "baseName": "South African Rand", "targetName": "US Dollars" }
    ];

    fs.writeFileSync('./scripts/data.json', JSON.stringify([...currOld, ...currNew], null, 4));
    console.log('Currency fixed');
} catch (e) {
    console.error(e);
}
