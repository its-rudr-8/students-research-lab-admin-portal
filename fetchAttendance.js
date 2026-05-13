import pkg from '@prisma/client';
const { PrismaClient } = pkg;
console.log('DEBUG fetchAttendance cwd=', process.cwd());
console.log('DEBUG fetchAttendance DATABASE_URL=', process.env.DATABASE_URL);
const prisma = new PrismaClient();

async function main() {
  const data = await prisma.leaderboard_stats.findMany({
    select: {
      enrollment_no: true,
      attendance: true,
    },
  });
  console.log(data);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());