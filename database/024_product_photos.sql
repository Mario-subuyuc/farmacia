-- Fotografias de referencia: ver docs/imagenes-medicamentos.md.
begin;
update public.medicamentos m set imagen_url=f.url
from (values
 ('DEMO-PARA','https://walmartgt.vteximg.com.br/arquivos/ids/859333/95004_01.jpg?v=638905248408630000'),
 ('DEMO-AMOX','https://cdn.shopify.com/s/files/1/0368/1363/5716/files/7703763070237.jpg?v=1778646978'),
 ('DEMO-SUERO','https://walmartgt.vteximg.com.br/arquivos/ids/807434/93455_01.jpg?v=638820819168330000'),
 ('DEMO-IBU','https://cdn.shopify.com/s/files/1/0368/1363/5716/files/7703763270620.jpg?v=1794544612'),
 ('DEMO-LORA','https://walmartgt.vteximg.com.br/arquivos/ids/327207/Loratadina-Luveck-10Mg-10-Comprimidos-1-40527.jpg?v=638052898334970000'),
 ('DEMO-CETI','https://walmartgt.vteximg.com.br/arquivos/ids/288367/Alersone-10-Mg-10-Tabletas-1-32451.jpg?v=637935080079130000'),
 ('DEMO-OME','https://cdn.shopify.com/s/files/1/0368/1363/5716/files/7798032937205.jpg?v=1794544100'),
 ('DEMO-ANTI','https://farmaciauniversalpe.vteximg.com.br/arquivos/ids/164217/16867_1.jpg?v=638986518626400000'),
 ('DEMO-VITC','https://walmartgt.vteximg.com.br/arquivos/ids/984909/tabletas-masticables-cebion-vitamina-c-sabor-mandarina-500-mg-7702418004863.jpg?v=639123042405370000'),
 ('DEMO-SALB','https://walmartgt.vteximg.com.br/arquivos/ids/356407/Inhalador-Salbutamol-17gr-100mcg-1-56558.jpg?v=638170943568300000'),
 ('DEMO-LOSA','https://walmartgt.vteximg.com.br/arquivos/ids/291234/Losartan-Mk-50-Mg-20-Tabletas-1-32827.jpg?v=637955917337500000'),
 ('DEMO-CREMA','https://walmartgt.vteximg.com.br/arquivos/ids/333397/Hidrocortisona-1-Crema-30-Gramos-1-32791.jpg?v=638074174572600000')
) as f(codigo,url)
where m.codigo=f.codigo
 and (m.imagen_url is null or m.imagen_url like '%/catalogo/demo/photos/%');
commit;
