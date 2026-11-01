/** Shapes returned by /v1/admin/*. Kept in step with Backend/src/modules/admin*.ts. */

export type Role = 'user' | 'moderator' | 'admin';
export type AccountStatus = 'active' | 'pending_verification' | 'suspended' | 'banned' | 'deletion_pending';
export type Page<T> = { items: T[]; total: number };

export type Me = { userId: number; username: string; displayName: string; role: Role };

export type Stats = {
  totals: {
    users: number; newUsers7d: number; restrictedUsers: number; cards: number; capturesToday: number;
    pendingReviews: number; openReports: number; flaggedCaptures7d: number;
  };
  daily: { day: string; captures: number; cards: number; signups: number }[];
  captureStatus7d: { status: string; count: number }[];
  recognitionModels7d: { model: string; count: number; avgConfidence: number | null }[];
  unresolvedReasons7d: { reason: string; count: number }[];
  cardsByRarity: { rarity: string; count: number }[];
};

export type ReviewItem = {
  reviewId: number;
  captureId: number;
  reason: string;
  confidence: number | null;
  status: 'pending' | 'approved' | 'reassigned' | 'rejected';
  proposedVehicle: Recognition | null;
  proposedModelVariantId: number | null;
  proposedLabel: string | null;
  captureStatus: string;
  aiModel: string | null;
  user: { userId: number; username: string };
  riskReasons: string[];
  imageUrl: string | null;
  createdAt: string;
  decisionReason: string | null;
  reviewer: string | null;
  reviewedAt: string | null;
};

export type Recognition =
  | {
      kind: 'vehicle'; make: string; model: string; variant: string | null; year: number | null; color: string | null;
      confidence: number; alternatives?: { make: string; model: string }[];
    }
  | { kind: 'not_vehicle' | 'screen_or_print' | 'unavailable'; reason?: string; confidence?: number };

export type Capture = {
  captureId: number;
  user: { userId: number; username: string };
  status: string;
  statusReason: string | null;
  candidate: { modelVariantId: number; brand: string; model: string; variant: string; modelYear: number } | null;
  aiModel: string | null;
  confidence: number | null;
  riskScore: number | null;
  riskReasons: string[];
  cameraSource: string;
  imageBytes: number | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CaptureDetail = Capture & {
  recognition: Recognition | null;
  hasLocation: boolean;
  review: { reviewId: number; status: string; reason: string; decisionReason: string | null; reviewedAt: string | null } | null;
  history: AuditBrief[];
};

export type AuditBrief = { auditId: number; action: string; reason: string; actor: string | null; createdAt: string };

export type User = {
  userId: number; username: string; displayName: string; email: string | null; emailVerified: boolean; role: Role; accountStatus: AccountStatus;
  countryCode: string | null; city: string | null; coins: number; xp: number; level: number; carCount: number; createdAt: string;
};

export type UserDetail = User & {
  counts: { captures: number; posts: number; followers: number; following: number; reportsAgainst: number };
  recentCaptures: {
    captureId: number; status: string; statusReason: string | null; vehicle: string | null; confidence: number | null;
    riskReasons: string[]; imageUrl: string | null; createdAt: string;
  }[];
  coinTransactions: { transactionId: number; amount: number; type: string; balanceAfter: number; createdAt: string }[];
  history: AuditBrief[];
};

export type Report = {
  reportId: number; targetType: 'post' | 'comment' | 'card' | 'capture' | 'user'; targetId: number; reason: string;
  description: string | null; status: string; createdAt: string; reviewedAt: string | null; reporterId: number;
  reporterUsername: string; targetText: string | null; targetStatus: string | null; targetUserId: number | null;
  targetUsername: string | null; reportCount: number;
};

export type Brand = { brandId: number; name: string; countryOfOrigin: string | null; isActive: boolean; modelCount: number };

export const RARITIES = ['base', 'special', 'sporty', 'royal', 'classic', 'rare', 'elite', 'legendary', 'mythic'] as const;
export const BODY_STYLES = ['sedan', 'hatch', 'coupe', 'suv', 'pickup', 'van'] as const;
export type Rarity = (typeof RARITIES)[number];

export type Model = {
  modelId: number; brandId: number; brandName: string; name: string; vehicleCategory: string | null;
  bodyStyle: (typeof BODY_STYLES)[number]; rarity: Rarity; introductionYear: number | null; discontinuedYear: number | null;
  summary: string | null; isActive: boolean; variantCount: number;
};

export type PhotoView = 'front' | 'left' | 'right' | 'rear';
export type VariantPhoto = { view: PhotoView; imageUrl: string; credit: string | null };

export type Variant = {
  photos?: VariantPhoto[];
  modelVariantId: number; modelId: number; modelVariantName: string; modelYear: number; modelYearEnd: number | null;
  xpReward: number; fuelType: string | null; engineDisplacementCc: number | null; engineCylinders: number | null;
  horsepowerHp: number | null; torqueNm: number | null; topSpeedMph: number | null; acceleration0To60Mph: number | null;
  transmissionType: string | null; drivetrain: string | null; seatingCapacity: number | null; doorCount: number | null;
  curbWeightKg: number | null; numberOfGears: number | null; lengthMm: number | null; widthMm: number | null;
  heightMm: number | null; wheelbaseMm: number | null; isActive: boolean;
};

export type ModelDetail = Model & { cardCount: number; variants: Variant[]; aliases: { aliasId: number; alias: string }[] };

export type VariantHit = {
  modelVariantId: number; brandName: string; modelName: string; modelVariantName: string; modelYear: number;
  modelYearEnd: number | null; rarity: Rarity;
};

export type AuditEntry = {
  auditId: number; action: string; targetType: string; targetId: number; before: unknown; after: unknown; reason: string;
  requestId: string | null; createdAt: string; actorId: number; actorUsername: string | null;
};

export type CoinOffer = {
  offerId: number; title: string; coinsAmount: number; bonusCoins: number; price: number; currency: string;
  productIdentifier: string | null; isActive: boolean; createdAt: string;
};
export type GarageOffer = {
  offerId: number; title: string; rewardSlots: number; offerType: 'AD_WATCH' | 'PURCHASE'; price: number; currency: string;
  productIdentifier: string | null; isActive: boolean; createdAt: string;
};

export type Purchases = {
  purchasesEnabled: boolean;
  coinPurchases: {
    purchaseId: number; userId: number; username: string; offerTitle: string; coinsReceived: number; amountPaid: number;
    currency: string; paymentStatus: string; storeTransactionId: string | null; createdAt: string;
  }[];
  garageRedemptions: {
    redemptionId: number; userId: number; username: string; offerTitle: string; slotsGranted: number; paymentStatus: string;
    transactionReference: string | null; createdAt: string;
  }[];
};
