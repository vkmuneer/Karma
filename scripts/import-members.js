// Usage: npm run import-members -- path/to/Contact_Information.xlsx
const { readRows, upsertMembers } = require('../src/importer');
require('../src/seed').seed();

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run import-members -- path/to/file.xlsx');
  process.exit(1);
}
readRows(file).then((rows) => {
  console.log(upsertMembers(rows));
}).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
