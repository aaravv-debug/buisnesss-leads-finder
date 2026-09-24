const fs = require('fs');
const path = require('path');
const jobs = require('../src/jobs');

const sampleLeads = [
  {
    name: 'Miami Strong Gym',
    category: 'Gym',
    phone: '+1 786-746-8112',
    emails: ['info@miamistronggym.com', 'support@miamistronggym.com'],
    website: 'https://www.miamistronggym.com/',
    address: '1830 N Bayshore Dr, Miami, FL 33132, United States',
    rating: 4.9,
    reviews: 998,
    socials: {
      instagram: 'https://instagram.com/miamistronggym',
      facebook: 'https://facebook.com/miamistronggym',
      linkedin: 'https://linkedin.com/company/miami-strong-gym'
    },
    googleMapsUrl: 'https://www.google.com/maps/place/Miami+Strong+Gym'
  },
  {
    name: 'Concep 360 Fitness',
    category: 'Fitness Center',
    phone: '(786) 982-2213',
    emails: ['contact@concep360.com'],
    website: 'https://concep360.com',
    address: '9469 South Dixie Highway, Pinecrest, FL 33156',
    rating: 4.9,
    reviews: 64,
    socials: {
      instagram: 'https://instagram.com/concep360',
      facebook: 'https://facebook.com/concep360'
    },
    googleMapsUrl: 'https://www.google.com/maps/place/Concep+360+Fitness'
  }
];

// Test CSV
const csv = jobs.exportToCSV(sampleLeads);
fs.writeFileSync(path.join(__dirname, 'test_output.csv'), csv, 'utf8');
console.log('--- GENERATED CSV PREVIEW ---');
console.log(csv);

// Test Excel
const xlsxBuffer = jobs.exportToExcel(sampleLeads);
fs.writeFileSync(path.join(__dirname, 'test_output.xlsx'), xlsxBuffer);
console.log('\nGenerated Excel buffer of size:', xlsxBuffer.length, 'bytes');

console.log('Export tests succeeded cleanly!');
