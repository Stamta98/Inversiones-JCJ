-- El nombre del cargo que se le cobro al cliente aparte de la cuota. Vacio en
-- los movimientos de siempre; con nombre, el movimiento es un cargo cobrado en
-- la puerta y no el que se descuenta al entregar la plata.
ALTER TABLE "CashMovement" ADD COLUMN "chargeName" TEXT;
