-- Update sales table to include discount reason, supportive ID, and booking_id
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_reason TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_id_url TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS booking_id UUID;

-- Update massage_bookings table to include discount reason and supportive ID
ALTER TABLE massage_bookings ADD COLUMN IF NOT EXISTS discount_reason TEXT;
ALTER TABLE massage_bookings ADD COLUMN IF NOT EXISTS discount_id_url TEXT;

-- Update guests table to include ID card URL
ALTER TABLE guests ADD COLUMN IF NOT EXISTS id_card_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN sales.discount_reason IS 'Reason for applying a discount to this sale';
COMMENT ON COLUMN sales.discount_id_url IS 'URL to a supportive document or ID for the discount';
COMMENT ON COLUMN sales.booking_id IS 'Reference to the original booking ID if this sale originated from a service';
COMMENT ON COLUMN massage_bookings.discount_reason IS 'Reason for applying a discount to this booking';
COMMENT ON COLUMN massage_bookings.discount_id_url IS 'URL to a supportive document or ID for the discount';
