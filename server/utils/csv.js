const sanitizeFilename = (filename) => filename.replace(/[^a-z0-9_.-]/gi, '_');

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) return '';

  const normalized = String(value).replace(/\r?\n/g, ' ');
  return `"${normalized.replace(/"/g, '""')}"`;
};

const rowsToCsv = (headers, rows) => {
  const headerLine = headers.join(',');
  const rowLines = rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(','));

  return [headerLine, ...rowLines].join('\n') + '\n';
};

const sendCsv = (res, filename, headers, rows) => {
  const safeFilename = sanitizeFilename(filename);
  const csv = rowsToCsv(headers, rows);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.send(csv);
};

module.exports = {
  escapeCsvValue,
  rowsToCsv,
  sendCsv
};
