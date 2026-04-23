import type {
  BookingSummary,
  CuratedStayResponse,
  CuratedStayOption,
  PointsRedemption,
} from "./curatedBookingContract";

const STAY_OPTIONS: [CuratedStayOption, CuratedStayOption, CuratedStayOption] = [
  {
    hotelId: "stay_bellweather_001",
    hotelName: "Hotel Bellweather",
    location: "SoHo, New York",
    price: 265,
    currency: "USD",
    tags: ["Premium", "King bed", "Quiet wing", "Work desk"],
    reasonForRecommendation:
      "Matches your preference for quiet premium spaces with warm ambience and fast check-in flow.",
    pointsEarn: 320,
    nightlyDetails: {
      nights: 2,
      ratePerNight: 265,
      totalBeforeTax: 530,
    },
    cancellationPolicy: "Free cancellation up to 24h before check-in",
    image:
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=80",
  },
  {
    hotelId: "stay_grand_002",
    hotelName: "The Grand Budapest",
    location: "Upper East Side, New York",
    price: 299,
    currency: "USD",
    tags: ["Luxury", "Neutral mood", "Business ready"],
    reasonForRecommendation:
      "Strong fit for your business-plus-comfort pattern with neutral lighting and reliable in-room workspace.",
    pointsEarn: 370,
    nightlyDetails: {
      nights: 2,
      ratePerNight: 299,
      totalBeforeTax: 598,
    },
    cancellationPolicy: "Free cancellation up to 48h before check-in",
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
  },
  {
    hotelId: "stay_nordic_003",
    hotelName: "Nordic Atelier House",
    location: "Tribeca, New York",
    price: 238,
    currency: "USD",
    tags: ["Design", "Leisure", "Calm"],
    reasonForRecommendation:
      "Best value match for a calm trip with a design-forward setting and balanced room climate defaults.",
    pointsEarn: 280,
    nightlyDetails: {
      nights: 2,
      ratePerNight: 238,
      totalBeforeTax: 476,
    },
    cancellationPolicy: "Free cancellation up to 24h before check-in",
    image:
      "https://images.unsplash.com/photo-1578774204375-826dc5d996ed?auto=format&fit=crop&w=1200&q=80",
  },
];

export const MOCK_CURATED_STAY_RESPONSE: CuratedStayResponse = {
  conversationSummary:
    "You asked ORIN for a premium but calm stay with quick booking and reliable room comfort.",
  options: STAY_OPTIONS,
  rankingMetadata: {
    rankedBy: "orin-ai",
    confidenceScore: 0.93,
    generatedAt: "2026-04-23T00:00:00.000Z",
  },
  nextAction: "Select one stay and ORIN will prepare a booking summary.",
};

export const buildMockBookingSummary = (
  selectedOption: CuratedStayOption,
  pointsToRedeem = 200
): BookingSummary => {
  const taxAmount = Math.round(selectedOption.nightlyDetails.totalBeforeTax * 0.1);
  const maxDiscount = Math.round(selectedOption.nightlyDetails.totalBeforeTax * 0.08);
  const discountAmount = Math.min(Math.floor(pointsToRedeem / 10), maxDiscount);
  const pointsRedemption: PointsRedemption = {
    pointsUsed: Math.min(pointsToRedeem, discountAmount * 10),
    discountAmount,
  };

  const priceLines = [
    {
      label: `Deluxe stay x ${selectedOption.nightlyDetails.nights} night(s)`,
      amount: selectedOption.nightlyDetails.totalBeforeTax,
      lineType: "base" as const,
    },
    {
      label: "Tax & fees (10%)",
      amount: taxAmount,
      lineType: "tax" as const,
    },
    {
      label: "ORIN points discount",
      amount: -pointsRedemption.discountAmount,
      lineType: "discount" as const,
    },
  ];

  return {
    checkInDate: "2026-05-12",
    checkOutDate: "2026-05-14",
    guests: 2,
    selectedOption,
    priceLines,
    pointsRedemption,
    payableTotal:
      selectedOption.nightlyDetails.totalBeforeTax + taxAmount - pointsRedemption.discountAmount,
    currency: selectedOption.currency,
  };
};