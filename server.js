const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const targetUrl = 'https://sunnyyummy.cashier.ecpay.com.tw/';

// This middleware will catch all incoming requests, regardless of the path.
app.use((req, res) => {
  // Log the redirection for debugging purposes
  console.log(`Redirecting request for "${req.originalUrl}" to "${targetUrl}"`);
  
  // Perform a 301 Permanent Redirect
  res.redirect(301, targetUrl);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
  console.log(`All traffic is being permanently redirected to ${targetUrl}`);
});
