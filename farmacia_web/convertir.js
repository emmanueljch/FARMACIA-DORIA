const fs = require('fs');
const path = require('path');

// Nombre simplificado
const archivoEntrada = path.join(__dirname, 'datos.csv');
const archivoSalida = path.join(__dirname, 'datos_farmacia.sql');

try {
    const contenido = fs.readFileSync(archivoEntrada, 'utf-8');
    const lineas = contenido.split('\n');

    // Limpiamos el archivo de salida si ya existe
    if (fs.existsSync(archivoSalida)) fs.unlinkSync(archivoSalida);

    let registros = [];

    // Empezamos en 1 para saltar los encabezados
    for (let i = 1; i < lineas.length; i++) {
        const linea = lineas[i].trim();
        if (!linea) continue;

        // Separar por comas respetando comillas
        const campos = linea.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

        if (campos.length >= 6) {
            const ref = (campos[0] || '').replace(/'/g, "''").trim();
            const nombre = (campos[1] || '').replace(/'/g, "''").trim();
            const impuesto = (campos[3] || '').replace(/'/g, "''").trim();
            const costo = (campos[4] || '0').replace(/[^0-9.]/g, '');
            const precio = (campos[5] || '0').replace(/[^0-9.]/g, '');
            const precio_imp = (campos[6] || '0').replace(/[^0-9.]/g, '');

            registros.push(`('${ref}', '${nombre}', '${impuesto}', ${costo || 0}, ${precio || 0}, ${precio_imp || 0})`);
        }

        // Escribir en bloques de 500 para que Supabase no se trabe
        if (registros.length === 500 || i === lineas.length - 1) {
            const sql = `INSERT INTO productos (ref, nombre, impuesto, costo, precio, precio_con_impuesto) VALUES \n${registros.join(',\n')};\n\n`;
            fs.appendFileSync(archivoSalida, sql);
            registros = [];
        }
    }

    console.log('---------------------------------------------------------');
    console.log('✅ ¡EXITO! Se ha creado el archivo: datos_farmacia.sql');
    console.log('---------------------------------------------------------');

} catch (err) {
    console.error('❌ ERROR:', err.message);
    console.log('\nASEGÚRATE DE QUE:');
    console.log('1. El archivo se llame exactamente: datos.csv');
    console.log(`2. Esté en la carpeta: ${__dirname}`);
}