-- Coin Cubby Kiosk - Database Schema

-- Users Table
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_code VARCHAR(6) UNIQUE NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    wallet_balance DECIMAL(10,2) DEFAULT 0.00,
    max_rentals INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Compartments Table
CREATE TABLE public.compartments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(3) UNIQUE NOT NULL, -- e.g., A01, B04
    module VARCHAR(1) NOT NULL, -- A or B
    size VARCHAR(10) NOT NULL, -- small, medium, large
    status VARCHAR(20) DEFAULT 'available', -- available, occupied, maintenance
    rate_per_hour DECIMAL(10,2) DEFAULT 10.00
);

-- Rentals Table
CREATE TABLE public.rentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id),
    compartment_id UUID REFERENCES public.compartments(id),
    rental_type VARCHAR(20) NOT NULL, -- fixed, open_time
    status VARCHAR(20) DEFAULT 'active', -- active, completed
    duration_hours INTEGER NULL, -- null if open_time
    rental_fee DECIMAL(10,2) NULL,
    service_fee DECIMAL(10,2) DEFAULT 5.00,
    total_amount DECIMAL(10,2) NULL,
    payment_method VARCHAR(20) NULL, -- wallet, cash
    started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    expires_at TIMESTAMP WITH TIME ZONE NULL,
    retrieved_at TIMESTAMP WITH TIME ZONE NULL
);

-- Transactions Table
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id),
    rental_id UUID REFERENCES public.rentals(id) NULL,
    type VARCHAR(20) NOT NULL, -- rental_payment, retrieval_payment, wallet_topup
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Initial Compartment Data (2 Modules, 4 Compartments each)
INSERT INTO public.compartments (code, module, size) VALUES
('A01', 'A', 'small'),
('A02', 'A', 'small'),
('A03', 'A', 'medium'),
('A04', 'A', 'large'),
('B01', 'B', 'small'),
('B02', 'B', 'small'),
('B03', 'B', 'medium'),
('B04', 'B', 'large');
