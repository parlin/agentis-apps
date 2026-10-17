# Modeller - alternativa karosser

Färdiga 3D-modeller som kan visas i stället för den egna E91-karossen, både i delkartan
(`index.html`, väljaren "Kaross" bredvid opacitetsreglaget, djuplänk `#kaross=<id>`) och i
testsidan `kaross-test.html`. Listan, laddningen, normaliseringen och omfärgningen finns i den
delade modulen `../alt-kaross.js` (`ALT_KAROSSER`); väljarna, filnamnet och kreditraden byggs
från den. Delkartan listar bara poster med `finns: true` (filen ligger här), eftersom den inte
får göra anrop som misslyckas. Testsidan listar alla. Den egna karossen är standard och skrivs
inte i hashen.

Filerna läggs hit för hand som glTF Binary (`.glb`). Sketchfab kräver inloggning för nedladdning:
välj "Download 3D Model" -> "glTF Binary (.glb)" och spara under filnamnet nedan. En fil som saknas
ger bara ett meddelande i sidan; den laddas först när den väljs.

| Fil | Modell | Upphov | Licens | Källa | Status |
|---|---|---|---|---|---|
| `comrade-wagon.glb` | "Generic passenger car pack" (kombin) | Comrade1280 | CC BY 4.0 | https://sketchfab.com/3d-models/generic-passenger-car-pack-20f9af9b8a404d5cb022ac6fe87f21f5 | Finns. Modifierad: bara kombin ("Wagon Body" och hjulen Wheel_A..Wheel_A003) utplockad ur paketet med tio bilar, 1k-texturer. Skalas och omfärgas i sidan (lacken grå). |
| `han66st-wagon.glb` | "Lowpoly Sedan & Wagon" | Han66st | CC BY 4.0 | https://sketchfab.com/3d-models/lowpoly-sedan-wagon-e11a46478c674b279fe9d299b2125c30 | Läggs dit för hand. Två bilar i en fil: sätt `nod` i posten. |
| `passat-anserkon.glb` | "Generic USA/EU Station wagon" | Anserkon | CC BY 4.0 | https://sketchfab.com/3d-models/generic-usaeu-station-wagon-c14f271c9d414b8e8d25e7cec3bb44f5 | Läggs dit för hand. |

## Licens och kreditering

Alla tre är licensierade under Creative Commons Erkännande 4.0
(https://creativecommons.org/licenses/by/4.0/). **Kreditering krävs**: upphovspersonens namn,
modellens titel, länk till källan, länk till licensen och att modellen är ändrad. Testsidan visar
kreditraden automatiskt när en modell är vald; ta inte bort den, och ta med den om modellen
används någon annanstans.

## Filer med flera bilar

Om filen innehåller flera bilar loggar sidan nodnamnen på toppnivå i konsolen när filen laddas
(`[alt-kaross] ... noder på toppnivå`). Skriv in rätt namn i postens fält `nod`, eller prova
först med `kaross-test.html?kaross=<id>&nod=<namn>`.

## Normaliseringen

Sidan vrider modellen så att längden ligger längs x (huvudriktningen ur hjulen), skalar den
likformigt till E91:ans längd 4,52 m och sedan längs x så att hjulbasen blir exakt 2,76 m med
hjulen över axlarna x = +-1,38, och ställer den på marken. Hjulen hittas ur mesher med namn som
wheel/tire/rim, annars ur geometrins lägsta del. Fronten antas vara änden med kortast överhäng;
knappen "Vänd" i testsidan vänder modellen om det blev fel. Med fyra namngivna hjul skalas
bredden så att spårvidden blir E91:ans (1 500/1 513 mm), och modellen ställs så att hjulens
centrum ligger på navets höjd (`KAROSS_MATT.navY`), så att hjulhusen hamnar runt verktygets
egna hjul. Resultatet loggas i konsolen.

## I delkartan

- Modellens egna hjul döljs. Verktygets hjul (däckväljaren) används alltid, så att hjulens
  storlek och luften i hjulhuset fortsätter att synas.
- Modellen ligger i samma grupp som delarna och höjs med valt däck, följer opacitetsreglaget och
  temat. Den egna karossens ytor göms (förstörs inte); inredningen ligger kvar.
- Mätlinjerna för luften i hjulhusen är kalibrerade mot den egna karossen och göms. Däckpanelen
  visar en not om att luft-talen gäller E91-mätningarna.
- Modellens mesher är inte plockbara; klick och hovring träffar fortfarande delarna.

## Omfärgningen av lacken

Lacken på Comrade-kombin delar basfärgstextur med lister, galler, gummi och lyktinfattningar, så
materialets färg kan inte bara bytas. Metallic-roughness-texturen har däremot en egen färg för
lackens yta (255, 27, 0), som används som mask (`lack.mask` i posten). För maskens pixlar räknas
den inbakade skuggningen ut som ljushet relativt lackens typiska ljushet, mjukas upp (exponent 0,3
för kulörta pixlar, eftersom sidorna är mycket mörkare än taket i originalet) och multipliceras
med samma grå som den egna karossens lack (`userData.material.lack.color`, 0x8f99a4 ljust och
0xaab3bd mörkt tema). Övriga pixlar och materialen Glass, Optics och Wheel lämnas orörda. Texturen
skrivs om när temat växlar. En ny modell får en `lack`-post först när dess material är inspekterade.
