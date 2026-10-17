# Modeller - alternativa karosser till testsidan

Färdiga 3D-modeller som `kaross-test.html` kan visa i stället för den egna E91-karossen
(väljaren "Kaross:"). Listan finns i `ALT_KAROSSER` i `kaross-test.html`; väljaren, filnamnet
och kreditraden byggs från den.

Filerna läggs hit för hand som glTF Binary (`.glb`). Sketchfab kräver inloggning för nedladdning:
välj "Download 3D Model" -> "glTF Binary (.glb)" och spara under filnamnet nedan. En fil som saknas
ger bara ett meddelande i sidan; den laddas först när den väljs.

| Fil | Modell | Upphov | Licens | Källa | Status |
|---|---|---|---|---|---|
| `comrade-wagon.glb` | "Generic passenger car pack" (kombin) | Comrade1280 | CC BY 4.0 | https://sketchfab.com/3d-models/generic-passenger-car-pack-20f9af9b8a404d5cb022ac6fe87f21f5 | Finns. Modifierad: bara kombin ("Wagon Body" och hjulen Wheel_A..Wheel_A003) utplockad ur paketet med tio bilar, 1k-texturer. Skalas i sidan. |
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
knappen "Vänd" vänder modellen om det blev fel. Resultatet loggas i konsolen.
