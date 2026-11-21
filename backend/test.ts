async function myTest() {
  const session = await prisma.tableSession.findUnique({
    where: { id: 'test' },
    include: { table: true },
  });
}
