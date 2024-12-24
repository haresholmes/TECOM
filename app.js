const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware for parsing JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware to serve static files (e.g., index.html)
app.use(express.static(path.join(__dirname, 'public')));

// Storage configuration for multer to handle file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        cb(null, `${timestamp}_${file.originalname}`);
    },
});

const upload = multer({ storage });

// Route for Ziina payment submission
app.post('/submit-ziina', (req, res) => {
  const { name, apartment, amount } = req.body;

  // Validate input fields
  if (!name || !apartment || !amount) {
      console.error('Validation failed: Missing fields', { name, apartment, amount });
      return res.status(400).json({ message: 'All fields are required.' });
  }

  if (isNaN(amount)) {
      console.error('Validation failed: Invalid amount', amount);
      return res.status(400).json({ message: 'Amount must be a valid number.' });
  }

  const paymentData = {
      name,
      apartment,
      amount,
      method: 'Ziina',
      timestamp: new Date().toISOString(),
  };

  const dataFile = path.join(__dirname, 'data', 'payments.json');
  if (!fs.existsSync(path.join(__dirname, 'data'))) {
      fs.mkdirSync(path.join(__dirname, 'data'));
  }

  fs.readFile(dataFile, 'utf8', (err, data) => {
      let payments = [];
      if (err) {
          if (err.code === 'ENOENT') {
              console.warn('File not found, creating new file.');
          } else {
              console.error('Error reading data file:', err);
              return res.status(500).json({ message: 'Server error reading payment data.' });
          }
      } else if (data) {
          try {
              payments = JSON.parse(data);
          } catch (parseErr) {
              console.error('Error parsing JSON data:', parseErr);
              return res.status(500).json({ message: 'Server error parsing payment data.' });
          }
      }

      payments.push(paymentData);
      fs.writeFile(dataFile, JSON.stringify(payments, null, 2), (writeErr) => {
          if (writeErr) {
              console.error('Error writing to data file:', writeErr);
              return res.status(500).json({ message: 'Server error saving payment data.' });
          }

          // Successfully logged, send the Ziina URL back
          const ziinaUrl = `https://pay.ziina.com/haresholmes?amount=${encodeURIComponent(amount)}`;
          console.log('Payment logged successfully:', paymentData);
          res.json({ message: 'Payment logged successfully.', ziinaUrl });
      });
  });
});


// Route for Bank Transfer submission
app.post('/submit-bank-transfer', upload.single('receipt'), (req, res) => {
  const { name, apartment, amount } = req.body;
  const receipt = req.file;

  // Log incoming data for debugging
  console.log('Received data:', { name, apartment, amount, receipt });

  if (!name || !apartment || !amount || !receipt) {
      return res.status(400).json({ message: 'All fields are required, including receipt.' });
  }

  // Log payment data
  const paymentData = {
      name,
      apartment,
      amount,
      method: 'Bank Transfer',
      receiptPath: `/uploads/${receipt.filename}`,
      timestamp: new Date().toISOString(),
  };

  const dataFile = path.join(__dirname, 'data', 'payments.json');
  if (!fs.existsSync(path.join(__dirname, 'data'))) {
      fs.mkdirSync(path.join(__dirname, 'data'));
  }

  fs.readFile(dataFile, 'utf8', (err, data) => {
      let payments = [];
      if (!err && data) {
          payments = JSON.parse(data);
      }
      payments.push(paymentData);
      fs.writeFile(dataFile, JSON.stringify(payments, null, 2), (err) => {
          if (err) {
              return res.status(500).json({ message: 'Error saving bank transfer data.' });
          }
          res.json({ message: 'Bank transfer logged successfully.' });
      });
  });
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
