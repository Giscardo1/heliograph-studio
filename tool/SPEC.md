# Specifica di progetto (approvata in chat, 2026-08-13)

Obiettivo: estendere il mirror array di Bartlett con un software in due parti.
1. App web (React, client-side): parametri ambientali (luce sole/lampada,
   superficie 0-90 gradi, distanza, posa dispositivo), testo libero font 5x7,
   simulazione live con dimensione spot realistica e slider di tolleranza,
   diagnostica, export config.json (schema v1).
2. Tool Python: legge config.json (o standalone), ricalcola normali con
   verifica incrociata, genera STL (pilastri hex/quadrati con allineatori,
   zoccolo unificante, altezza auto), partiziona sul piatto, report PNG.
Requisiti confermati: entrambe le sorgenti; superficie arbitraria; specchi
hex e quadrati configurabili; sole manuale + auto (NOAA).
Decisioni tecniche: convenzioni assi (x destra, y avanti, z su);
azimut relativo 0 = sole alle spalle; tilt dispositivo "auto" = normale media;
matching ad anelli generalizzato; duplicazione ciclica dei bersagli quando
i punti sono meno degli specchi; errore esplicito se sono di piu'.
Qualita': 11 unit/e2e test; autoverifica ottica a 1e-9 m su ogni raggio.
