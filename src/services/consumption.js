// src/services/consumption.js

const dayjs = require("dayjs");
const { prisma } = require("../prisma.js");

async function applyCheckoutConsumption(params) {
  const { stayId, roomId, reservationId } = params;
  const checkoutDate = dayjs(params.checkoutDate).startOf("day");

  return await prisma.$transaction(async (tx) => {
    const profiles = await tx.consumptionProfile.findMany({
      where: { stayId, OR: [{ roomId: roomId ?? undefined }, { roomId: null }] },
      include: { product: true }
    });

    if (profiles.length === 0) return { applied: false, reason: "no_profiles" };

    const perProduct = new Map();

    for (const p of profiles) {
      const current = perProduct.get(p.productId) ?? { room: 0, common: 0 };
      current.room += p.consumptionPerCleaning;

      if (p.appliesToCommonAreas) {
        try {
          await tx.dailyCommonConsumptionLog.create({
            data: {
              stayId,
              productId: p.productId,
              date: checkoutDate.toDate(),
              quantity: p.consumptionPerCleaning
            }
          });
          current.common += p.consumptionPerCleaning;
        } catch {
          // unique violation já lançado
        }
      }
      perProduct.set(p.productId, current);
    }

    const out = [];
    for (const [productId, { room, common }] of perProduct.entries()) {
      const total = room + common;
      if (total <= 0) continue;

      const inv = await tx.inventory.update({
        where: { stayId_productId: { stayId, productId } },
        data: { quantity: { decrement: total } }
      }).catch(async () => {
        return await tx.inventory.upsert({
          where: { stayId_productId: { stayId, productId } },
          update: { quantity: { decrement: total } },
          create: { stayId, productId, quantity: -total, capacity: 0 }
        });
      });

      await tx.consumptionEvent.create({
        data: {
          stayId,
          roomId,
          productId,
          quantity: total,
          reason: "checkout",
          occurredAt: new Date(),
          reservationId
        }
      });

      out.push({ productId, room, common, total, inventoryAfter: inv.quantity });
    }

    return { applied: true, consumptions: out };
  });
}

module.exports = { applyCheckoutConsumption };
