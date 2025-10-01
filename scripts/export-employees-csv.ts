import { getDependencies } from '../src/common/utils/Dependencies';
import * as fs from 'fs';
import * as path from 'path';

async function exportEmployeesToCSV() {
  try {
    console.log('Fetching employees from database...');
    const dependencies = await getDependencies();
    const employees = await dependencies.employeeService.getEmployees({});

    console.log(`Found ${employees.length} employees`);

    // Build CSV content
    const headers = [
      'ID',
      'Full Name',
      'Email',
      'Department',
      'Position',
      'Location',
      'Voting Group',
      'Is Active',
      'Job Title',
      'Company Code',
      'Reports To',
      'Direct Reports Count',
      'Hire Date',
      'Source',
      'Role',
      'Exclude From Sync',
    ];

    const csvRows = [headers.join(',')];

    for (const emp of employees) {
      const row = [
        emp.id || '',
        `"${(emp.fullName || '').replace(/"/g, '""')}"`,
        emp.email || '',
        `"${(emp.department || '').replace(/"/g, '""')}"`,
        `"${(emp.position || '').replace(/"/g, '""')}"`,
        `"${(emp.location || '').replace(/"/g, '""')}"`,
        `"${(emp.votingGroup || '').replace(/"/g, '""')}"`,
        emp.isActive ? 'Yes' : 'No',
        `"${(emp.jobTitle || '').replace(/"/g, '""')}"`,
        emp.companyCode || '',
        emp.reportsTo || '',
        emp.directReportsCount !== undefined ? emp.directReportsCount.toString() : '',
        emp.hireDate ? new Date(emp.hireDate).toISOString().split('T')[0] : '',
        emp.source || '',
        emp.role || '',
        emp.excludeFromSync ? 'Yes' : 'No',
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    // Write to file
    const outputPath = path.join(__dirname, '../analysis/employees.csv');
    fs.writeFileSync(outputPath, csvContent, 'utf-8');

    console.log(`✓ CSV file written to: ${outputPath}`);
    console.log(`Total employees exported: ${employees.length}`);
  } catch (error) {
    console.error('Error exporting employees:', error);
    process.exit(1);
  }
}

exportEmployeesToCSV();
