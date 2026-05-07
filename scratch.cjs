const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.students_details.findMany({ where: { student_name: { contains: 'Ghetiya' } } })
  .then(r => console.log(r))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
