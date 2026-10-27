-- Dependencia del despacho asíncrono de avisos por correo.
-- No elimina/reinstala la extensión ni modifica datos o avisos anteriores.
-- Sin WITH SCHEMA: pg_net crea sus objetos en su esquema net.
CREATE EXTENSION IF NOT EXISTS pg_net;
