/**
 * Duffel Stays — Mock Data Layer
 * ------------------------------------------------
 * Activated automatically when DUFFEL_MOCK_MODE=true in .env,
 * OR when DUFFEL_API_KEY is empty/absent.
 *
 * Returns realistic Duffel-shaped sandbox responses without
 * hitting the real API. Lets the frontend be built & demoed
 * immediately while awaiting real Stays account access.
 *
 * Mock IDs use the same prefixes as real Duffel IDs:
 *   srr_  → search result
 *   rat_  → rate
 *   quo_  → quote
 *   bok_  → booking
 */

import type {
  OrinHotelCard,
  OrinQuoteCard,
  OrinBookingConfirmation,
  DuffelBookingRequest,
} from "./duffel.types";

// ---------------------------------------------------------------------------
// Mock hotel catalogue (VIP-curated for ORIN demo)
// ---------------------------------------------------------------------------

const MOCK_HOTELS: OrinHotelCard[] = [
  {
    search_result_id: "srr_MOCK_0000001_claridges",
    rate_id: "rat_MOCK_0000001_claridges_deluxe",
    accommodation_id: "acc_MOCK_0000001_claridges",
    name: "Claridge's",
    description:
      "London's most iconic luxury hotel, favoured by royalty and celebrities since 1856. Art Deco grandeur meets flawless modern service.",
    rating: 5,
    review_score: 9.4,
    review_count: 3241,
    image_url:
      "https://assets.duffel.com/img/stays/image.jpg",
    address: "Brook Street, Mayfair, London",
    city: "London",
    country_code: "GB",
    check_in_time: "15:00",
    check_out_time: "12:00",
    amenities: ["spa", "restaurant", "bar", "gym", "concierge", "room_service", "wifi"],
    cheapest_price: "1250.00",
    currency: "GBP",
    payment_type: "pay_now",
    free_cancellation: true,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  },
  {
    search_result_id: "srr_MOCK_0000002_savoy",
    rate_id: "rat_MOCK_0000002_savoy_thames_suite",
    accommodation_id: "acc_MOCK_0000002_savoy",
    name: "The Savoy",
    description:
      "Overlooking the Thames since 1889. Famous for its Kaspar the black cat mascot and the world-renowned American Bar. A London institution.",
    rating: 5,
    review_score: 9.1,
    review_count: 4872,
    image_url:
      "https://assets.duffel.com/img/stays/image.jpg",
    address: "Strand, Covent Garden, London",
    city: "London",
    country_code: "GB",
    check_in_time: "15:00",
    check_out_time: "11:00",
    amenities: ["spa", "pool", "restaurant", "bar", "gym", "concierge", "wifi", "valet"],
    cheapest_price: "980.00",
    currency: "GBP",
    payment_type: "pay_now",
    free_cancellation: true,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  },
  {
    search_result_id: "srr_MOCK_0000003_connaught",
    rate_id: "rat_MOCK_0000003_connaught_superior",
    accommodation_id: "acc_MOCK_0000003_connaught",
    name: "The Connaught",
    description:
      "Intimate Mayfair luxury with two Michelin-starred restaurants by Hélène Darroze. Awarded the world's best hotel bar three years running.",
    rating: 5,
    review_score: 9.6,
    review_count: 1893,
    image_url:
      "https://assets.duffel.com/img/stays/image.jpg",
    address: "Carlos Place, Mayfair, London",
    city: "London",
    country_code: "GB",
    check_in_time: "14:00",
    check_out_time: "12:00",
    amenities: ["spa", "restaurant", "bar", "concierge", "butler", "wifi", "valet"],
    cheapest_price: "1480.00",
    currency: "GBP",
    payment_type: "pay_now",
    free_cancellation: false,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  },
];

// ---------------------------------------------------------------------------
// In-memory quote store (lives for the process lifetime — hackathon style)
// ---------------------------------------------------------------------------
const mockQuoteStore = new Map<string, OrinQuoteCard>();
const mockBookingStore = new Map<string, OrinBookingConfirmation>();

let mockQuoteCounter = 1;
let mockBookingCounter = 1;

// ---------------------------------------------------------------------------
// Mock service methods — mirror duffel.service.ts public API exactly
// ---------------------------------------------------------------------------

export async function mockSearchStays(params: {
  check_in_date: string;
  check_out_date: string;
  rooms: number;
}): Promise<{ hotels: OrinHotelCard[]; total_found: number; search_created_at: string }> {
  // Simulate a slight network delay
  await new Promise((r) => setTimeout(r, 120));

  return {
    hotels: MOCK_HOTELS,
    total_found: MOCK_HOTELS.length,
    search_created_at: new Date().toISOString(),
  };
}

export async function mockCreateQuote(rate_id: string): Promise<OrinQuoteCard> {
  await new Promise((r) => setTimeout(r, 80));

  // Find which hotel owns this rate
  const hotel = MOCK_HOTELS.find((h) => h.rate_id === rate_id);
  if (!hotel) {
    throw new Error(`Mock: unknown rate_id '${rate_id}'`);
  }

  const quoteId = `quo_MOCK_${String(mockQuoteCounter++).padStart(10, "0")}`;
  const nights = 3; // default for demo
  const total = (parseFloat(hotel.cheapest_price) * nights).toFixed(2);
  const tax = (parseFloat(total) * 0.1).toFixed(2);

  const card: OrinQuoteCard = {
    quote_id: quoteId,
    accommodation_name: hotel.name,
    image_url: hotel.image_url,
    address: hotel.address,
    check_in_date: "2026-06-10",
    check_out_date: "2026-06-13",
    rooms: 1,
    total_amount: total,
    total_currency: hotel.currency,
    tax_amount: tax,
    due_at_accommodation: null,
    board_type: "room_only",
    cancellation_policy: hotel.free_cancellation
      ? [
          {
            refund_amount: total,
            currency: hotel.currency,
            before: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ]
      : [],
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };

  mockQuoteStore.set(quoteId, card);
  return card;
}

export async function mockCreateBooking(params: DuffelBookingRequest): Promise<OrinBookingConfirmation> {
  await new Promise((r) => setTimeout(r, 200));

  const quote = mockQuoteStore.get(params.quote_id);
  if (!quote) {
    throw new Error(`Mock: unknown quote_id '${params.quote_id}'`);
  }

  const bookingId = `bok_MOCK_${String(mockBookingCounter++).padStart(10, "0")}`;
  const confirmRef = `ORIN-${Math.random().toString(36).toUpperCase().slice(2, 8)}`;
  const leadGuest = params.guests[0];

  const confirmation: OrinBookingConfirmation = {
    booking_id: bookingId,
    reference: confirmRef,
    status: "confirmed",
    hotel_name: quote.accommodation_name,
    hotel_address: quote.address,
    image_url: quote.image_url,
    check_in_date: quote.check_in_date,
    check_out_date: quote.check_out_date,
    rooms: quote.rooms,
    total_amount: quote.total_amount,
    currency: quote.total_currency,
    guest_name: `${leadGuest.given_name} ${leadGuest.family_name}`,
    email: params.email,
    confirmed_at: new Date().toISOString(),
    check_in_after_time: "15:00",
    check_out_before_time: "12:00",
    amenities: ["spa", "restaurant", "wifi", "concierge"],
  };

  mockBookingStore.set(bookingId, confirmation);
  return confirmation;
}

export async function mockGetBooking(booking_id: string): Promise<OrinBookingConfirmation> {
  await new Promise((r) => setTimeout(r, 60));
  const booking = mockBookingStore.get(booking_id);
  if (!booking) throw new Error(`Mock: booking '${booking_id}' not found`);
  return booking;
}

export async function mockCancelBooking(booking_id: string): Promise<{ booking_id: string; status: string }> {
  await new Promise((r) => setTimeout(r, 80));
  const booking = mockBookingStore.get(booking_id);
  if (!booking) throw new Error(`Mock: booking '${booking_id}' not found`);
  booking.status = "cancelled";
  return { booking_id, status: "cancelled" };
}
