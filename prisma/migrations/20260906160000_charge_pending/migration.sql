-- Un cargo que no se descuenta al entregar ni se reparte entre las cuotas:
-- queda anotado en el préstamo para cobrárselo aparte cuando se pueda.
ALTER TYPE "ChargeMode" ADD VALUE IF NOT EXISTS 'PENDING';
