
(async () => {
    const fs = require('fs');
    const path = require('path');

    const dirs = [
        'test-fixtures/next13/app/api/users',
        'test-fixtures/next15/src/app/api/orders',
        'test-fixtures/next13/app'
    ];

    dirs.forEach(dir => {
        const fullPath = path.resolve(dir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
    });

    const files = [
        'test-fixtures/next13/app/api/users/route.ts',
        'test-fixtures/next15/src/app/api/orders/route.ts',
        'test-fixtures/next13/app/page.tsx'
    ];

    files.forEach(file => {
        const fullPath = path.resolve(file);
        if (!fs.existsSync(fullPath)) {
            fs.writeFileSync(fullPath, '// test fixture');
        }
    });

    console.log('Test fixtures created successfully.');
})();
