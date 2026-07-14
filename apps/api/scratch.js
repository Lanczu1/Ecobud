const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const lessonId = "cmraeyvu000014vtcqsl6wv0l";

  const updatedContent = `### How to Plant Seeds

Growing plants is a simple and rewarding way to help the environment. Here is a step-by-step guide to get you started with planting seeds in containers:

1. **Prepare Your Container**: 
   Take a suitable container and fill it with a good quality soil mix. Fill it up to about three-quarters full, or near the surface. 
2. **Pack the Soil**: 
   Lightly pack the soil down using finger pressure. Be careful not to pack it too tightly; it should remain loose enough to easily make holes for your seeds.
3. **Plant the Seeds**: 
   Place your seeds into the soil. A good rule of thumb is to plant a seed about as deep as its own thickness (e.g., an 1/8-inch seed goes about 1/8 to 1/4 inch deep). Lay the seeds on their sides; they will naturally right themselves as they sprout.
4. **Water and Wait**: 
   Keep the soil moist and ensure the container gets enough sunlight. Germination usually takes about 7 to 10 days.

Happy planting!`;

  const updatedTranscript = `Hi, I'm Stan DeFreitas, Mr. Green Thumb. We're going to talk about containers and planting seeds.

If you've got a container like this, you can simply take your good soil, your good mix, fill it up, and make sure that you get it pretty near the—well, three quarters of the container at least, if not up to the surface. Pack it down lightly. You want to use finger pressure, you can. But you don't want to pack the soil so tightly that you can't make holes.

Take your seeds, plant your little seeds, usually about one time as deep as the seed is thick. So in this case, if it's about an 8th inch seed, at least an 8th inch or a quarter inch deep, making sure we plant all the little seeds down and you just lay them on their sides. They'll right themselves as they start to germinate.

Germination should take place on these probably in about 7 to 10 days. Keep them moist and make sure they get enough moisture and enough sunlight so the germination process can take place. 

For starting seeds and containers, I'm Stan DeFreitas, Mr. Green Thumb.`;

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      content: updatedContent,
      transcript: updatedTranscript
    }
  });

  console.log("Successfully updated the lesson content and transcript!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
