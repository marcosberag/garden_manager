import { XMLParser } from 'fast-xml-parser';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: Request) {
  try {
    // Con sesión: la ruta hace de proxy contra el Catastro y no tiene por qué
    // estar abierta a cualquiera que conozca la URL.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const rcParam = searchParams.get('refcat');

    let refcat = rcParam;
    const parser = new XMLParser();

    if (!refcat) {
      if (!lat || !lng) {
        return Response.json({ error: 'Lat and Lng or refcat are required' }, { status: 400 });
      }

      // 1. Get Referencia Catastral (RC) from Coordinates
      const rcUrl = `http://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_RCCOOR?SRS=EPSG:4326&Coordenada_X=${lng}&Coordenada_Y=${lat}`;
      const rcResponse = await fetch(rcUrl);
      if (!rcResponse.ok) throw new Error('Error fetching RC from Catastro');
      
      const rcXml = await rcResponse.text();
      const rcData = parser.parse(rcXml);

      // The structure is consulta_coordenadas -> coordenadas -> coord -> pc -> pc1 / pc2
      const coord = rcData?.consulta_coordenadas?.coordenadas?.coord;
      
      // coord can be an array if there are multiple parcels, or a single object.
      const firstCoord = Array.isArray(coord) ? coord[0] : coord;
      const pc = firstCoord?.pc;

      if (!pc || !pc.pc1 || !pc.pc2) {
        return Response.json({ error: 'No se encontró parcela catastral en estas coordenadas.' }, { status: 404 });
      }
      
      refcat = `${pc.pc1}${pc.pc2}`;
    }

    // 2. Get Geometry (GML) from WFS using RC
    const wfsUrl = `http://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?service=wfs&version=2&request=getfeature&STOREDQUERY_ID=GetParcel&refcat=${refcat}&srsname=EPSG:4326`;
    const wfsResponse = await fetch(wfsUrl);
    if (!wfsResponse.ok) throw new Error('Error fetching WFS from Catastro');
    
    const wfsXml = await wfsResponse.text();
    const wfsData = parser.parse(wfsXml);

    // 3. Extract coordinates from GML
    let posListStr = '';
    
    try {
      const feature = wfsData['wfs:FeatureCollection']['wfs:member']['cp:CadastralParcel'];
      
      // Catastro can return Polygon or Surface
      const surfaceMember = feature['cp:geometry']['gml:MultiSurface']['gml:surfaceMember'];
      
      if (surfaceMember['gml:Polygon']) {
        posListStr = surfaceMember['gml:Polygon']['gml:exterior']['gml:LinearRing']['gml:posList'];
      } else if (surfaceMember['gml:Surface']) {
        posListStr = surfaceMember['gml:Surface']['gml:patches']['gml:PolygonPatch']['gml:exterior']['gml:LinearRing']['gml:posList'];
      }
      
      // If posList is an object (due to attributes like srsDimension)
      if (typeof posListStr === 'object' && posListStr['#text']) {
        posListStr = posListStr['#text'];
      }
    } catch {
      // Try alternative paths if XML structure varies slightly (which it often does in GML)
      const matches = wfsXml.match(/<gml:posList[^>]*>([\s\S]*?)<\/gml:posList>/);
      if (matches && matches[1]) {
        posListStr = matches[1].trim();
      } else {
        throw new Error('No geometry found in WFS response');
      }
    }

    // 4. Convert posList to GeoJSON Polygon (Array of [lng, lat])
    // GML EPSG:4326 usually returns lat lng lat lng
    const coordsArray = posListStr.trim().split(/\s+/).map(Number);
    const geoJsonCoords = [];
    
    for (let i = 0; i < coordsArray.length; i += 2) {
      const latVal = coordsArray[i];
      const lngVal = coordsArray[i + 1];
      // GeoJSON requires [lng, lat]
      geoJsonCoords.push([lngVal, latVal]);
    }

    const geojson = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [geoJsonCoords]
      },
      properties: {
        refcat: refcat
      }
    };

    return Response.json(geojson);
  } catch (error) {
    console.error('Error in parcel extraction:', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Error processing parcel' }, { status: 500 });
  }
}
