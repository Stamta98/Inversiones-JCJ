-- La placa del vehículo con el que trabaja el cliente.
--
-- Un taxista o un mototaxista no está en la casa a la hora de cobrar: está en
-- la calle, y la placa es lo que lo identifica ahí.

ALTER TABLE "Customer" ADD COLUMN "vehiclePlate" TEXT;
