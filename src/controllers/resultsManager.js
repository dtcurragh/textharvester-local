const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger'); // Adjust the path as needed
const config = require('../../config.json'); // Adjust the path as needed
const { jsonToCsv } = require('../utils/dataConversion'); // Adjust path as needed
const moment = require('moment'); // Ensure moment is installed and imported
const { getTotalFiles, getProcessedFiles } = require('../utils/fileQueue.js'); // Adjust the path as needed

function getProcessingStatus(req, res) {
  const flagPath = path.join(
    __dirname,
    '../../data', // This moves up two levels from src/controllers
    'processing_complete.flag'
  );

  // Use fs.access to check for the existence of the flag file
  fs.access(flagPath, fs.constants.F_OK, (err) => {
    if (!err) {
      // If no error, file exists, proceed to read it
      fs.readFile(flagPath, 'utf8', (readErr, data) => {
        if (readErr) {
          logger.error('Error reading processing complete flag:', readErr);
          return res.status(500).send('Error checking processing status.');
        }
        if (data === 'complete') {
          res.json({ status: 'complete', progress: 100 });
        } else {
          const totalFiles = getTotalFiles();
          const processedFiles = getProcessedFiles();
          let progress =
            totalFiles > 0 ? (processedFiles / totalFiles) * 100 : 0;
          res.json({ status: 'processing', progress: progress.toFixed(2) });
        }
      });
    } else {
      // If error (meaning file does not exist), consider it still processing
      const totalFiles = getTotalFiles();
      const processedFiles = getProcessedFiles();
      let progress = totalFiles > 0 ? (processedFiles / totalFiles) * 100 : 0;
      res.json({ status: 'processing', progress: progress.toFixed(2) });
    }
  });
}

function getResultsData(req, res) {
  const resultsPath = path.join(__dirname, '../../', config.resultsPath);

  try {
    const data = fs.readFileSync(resultsPath, 'utf8');
    logger.info('Sending results data.');
    res.json(JSON.parse(data));
  } catch (err) {
    logger.error('Error reading results file:', err);
    res.status(500).send('Unable to retrieve results.');
  }
}

function downloadResultsJSON(req, res) {
  const resultsPath = path.join(__dirname, '../../', config.resultsPath);

  // Extract filename from query parameters or use a default
  const defaultFilename = 'results.json';
  const requestedFilename = req.query.filename
    ? `${req.query.filename}.json`
    : defaultFilename;

  // Optional: Sanitize the filename to avoid security issues
  const safeFilename = sanitizeFilename(requestedFilename);

  try {
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFilename}"`
    );
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(resultsPath);
  } catch (err) {
    logger.error('Error sending results file:', err);
    res.status(500).send('Unable to download results.');
  }
}

// Utility function to sanitize filenames (basic example)
function sanitizeFilename(filename) {
  if (!filename) {
    return '_'; // Default value for null or undefined input
  }

  return filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function downloadResultsCSV(req, res) {
  const resultsPath = path.join(__dirname, '../../', config.resultsPath);

  const requestedFilename = req.query.filename
    ? `${sanitizeFilename(req.query.filename)}.csv`
    : `hgth_results_${moment().format('YYYYMMDD_HHmmss')}.csv`;

  fs.readFile(resultsPath, 'utf8', (err, data) => {
    if (err) {
      logger.error('Error reading results file:', err);
      return res.status(500).send('Unable to retrieve results.');
    }

    const jsonData = JSON.parse(data);
    const csvData = jsonToCsv(jsonData);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${requestedFilename}"`
    );
    res.setHeader('Content-Type', 'text/csv');
    res.send(csvData);
  });
}

module.exports = {
  getProcessingStatus,
  getResultsData,
  downloadResultsJSON,
  downloadResultsCSV,
  sanitizeFilename,
};
