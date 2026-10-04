# Écart fonctionnel — Gestion commerciale / Comptabilité / Fiscalité / Trésorerie / RH

Ce document liste les modules demandés et leur état dans le projet.

## 1. Gestion commerciale
| Module | État |
|---|---|
| Clients / fournisseurs | Partiel — `AdminClients` (clients) + `AdminSuppliers` (fournisseurs) existants |
| Devis | ✅ UI livrée — `AdminQuotes.tsx` (`/admin/quotes`), données mock, API à brancher |
| Bons de commande | ✅ UI livrée — `AdminPurchaseOrders.tsx` (`/admin/purchase-orders`), données mock, API à brancher |
| Bons de livraison | ✅ UI livrée — `AdminDeliveryNotes.tsx` (`/admin/delivery-notes`), données mock, API à brancher |
| Factures / avoirs | ✅ UI livrée — `AdminInvoices.tsx` (`/admin/invoices`), données mock, API à brancher |
| Règlements / encaissements | ✅ UI livrée — `AdminPayments.tsx` (`/admin/payments`), données mock, API à brancher |
| Retenue à la source | ✅ Intégrée — calcul 1,5 % dans `AdminInvoices` (aperçu) + type de déclaration dans `AdminTax` |
| TVA / timbre | ✅ Intégrés — TVA 19 % + timbre fiscal 1,000 TND (Devis, Factures, Bons de commande) + suivi dans `AdminTax` |

## 2. Comptabilité
| Module | État |
|---|---|
| Plan comptable tunisien | ✅ UI livrée — `AdminAccounting.tsx` (`/admin/accounting`), onglet « Plan comptable » (classes 1-7 SCE) |
| Journaux | ✅ UI livrée — onglet « Journaux » de `AdminAccounting` |
| Écritures comptables | ✅ UI livrée — onglet « Écritures » (débit/crédit, contrôle d'équilibre) |
| Grand livre | ✅ UI livrée — onglet « Grand livre » (agrégation par compte) |
| Balance | ✅ UI livrée — onglet « Balance » (soldes débiteurs/créditeurs) |
| Lettrage | À créer — nécessite backend |
| Bilan / état de résultat | À créer — nécessite backend |
| Rapprochement bancaire | À créer — nécessite backend (lié à `AdminTreasury`) |

## 3. Fiscalité tunisienne
| Module | État |
|---|---|
| TVA | ✅ UI livrée — `AdminTax.tsx` (`/admin/tax`), type de déclaration TVA |
| Retenue à la source | ✅ UI livrée — type « Retenue à la source » (1,5 %) dans `AdminTax` |
| FODEC | ✅ UI livrée — type FODEC (1 %) dans `AdminTax` |
| Timbre fiscal | ✅ UI livrée — type « Timbre fiscal » dans `AdminTax` |
| IS / IRPP | ✅ UI livrée — type « IS / IRPP » dans `AdminTax` |
| TEJ | ✅ UI livrée — type TEJ (0,2 %) dans `AdminTax` |
| Déclarations fiscales | ✅ UI livrée — liste des déclarations, échéances, statuts (à déclarer / déclarée / payée / en retard) |
| E-facture / TTN / TEIF | Partiel — note d'intégration TTN affichée dans `AdminTax` (télédéclaration à brancher) |

## 4. Trésorerie
| Module | État |
|---|---|
| Caisse | ✅ UI livrée — `AdminTreasury.tsx` (`/admin/treasury`), onglet « Comptes » (caisse) |
| Banques | ✅ UI livrée — onglet « Comptes » (banques + RIB) |
| Encaissements | ✅ UI livrée — onglet « Mouvements » (entrées) + `AdminPayments` |
| Décaissements | ✅ UI livrée — onglet « Mouvements » (sorties) + `AdminPayments` |
| Chèques | ✅ UI livrée — onglet « Chèques & traites » (statuts portefeuille/remis/encaissé/impayé) |
| Traites | ✅ UI livrée — onglet « Chèques & traites » |
| Échéanciers | ✅ UI livrée — onglet « Échéancier » (effets à venir triés) |
| Rapprochement bancaire | À créer — nécessite backend |

## 5. RH & Paie
| Module | État |
|---|---|
| Employés | ✅ UI livrée — `AdminHr.tsx` (`/admin/hr`), onglet « Employés » |
| Contrats | ✅ UI livrée — types de contrat (CDI/CDD/SIVP/stage) dans l'onglet Employés |
| Congés | ✅ UI livrée — onglet « Congés » (annuel/maladie/sans solde/maternité, statuts) |
| Pointage | À créer — nécessite backend (badgeuse/heures) |
| Salaires | ✅ UI livrée — onglet « Paie » (masse salariale, coût employeur) |
| CNSS | ✅ Intégrée — CNSS salariale 9,18 % + patronale 16,57 % dans les bulletins |
| IRPP | ✅ Intégrée — barème progressif (0/26/28/32/35 %) dans les bulletins |
| Bulletins de paie | ✅ UI livrée — tiroir bulletin de paie détaillé (brut → net + charges patronales) |


---

## Avancement — livré à ce jour

### Gestion commerciale
- **Devis** (`src/pages/admin/AdminQuotes.tsx`, route `/admin/quotes`) — liste, recherche, filtres par statut (brouillon / envoyé / accepté / refusé / expiré / converti), pagination, cartes de synthèse, action « Convertir en facture ».
- **Bons de commande** (`src/pages/admin/AdminPurchaseOrders.tsx`, route `/admin/purchase-orders`) — commandes fournisseurs, statuts (brouillon / envoyé / confirmé / partiel / réceptionné / annulé), filtres, pagination, KPIs (total, en attente, réceptionnés, encours fournisseurs), action « Réceptionner ». TVA 19 % + timbre.
- **Bons de livraison** (`src/pages/admin/AdminDeliveryNotes.tsx`, route `/admin/delivery-notes`) — suivi expéditions, statuts (en attente / préparation / expédié / livré / retourné / annulé), lien facture, action « Facturer » quand livré et non facturé.
- **Factures & Avoirs** (`src/pages/admin/AdminInvoices.tsx`, route `/admin/invoices`) — liste factures + avoirs, filtres type/statut, KPIs (CA HT, TVA collectée, en attente, encaissé), tiroir d'aperçu avec ventilation fiscale complète.
- **Règlements & encaissements** (`src/pages/admin/AdminPayments.tsx`, route `/admin/payments`) — encaissements clients + décaissements fournisseurs, modes (espèces / chèque / virement / carte / traite), statuts, filtre direction, KPIs (encaissé, décaissé, solde net, en attente).

### Comptabilité
- **`src/pages/admin/AdminAccounting.tsx`** (route `/admin/accounting`) — UI à onglets : Plan comptable (classes 1-7 du SCE tunisien), Journaux, Écritures (lignes débit/crédit avec contrôle d'équilibre), Grand livre (agrégation par compte), Balance (soldes débiteurs/créditeurs + totaux).

### Fiscalité tunisienne
- **`src/pages/admin/AdminTax.tsx`** (route `/admin/tax`) — déclarations TVA, retenue à la source (1,5 %), FODEC (1 %), timbre fiscal, IS/IRPP, TEJ (0,2 %). Échéances, statuts (à déclarer / déclarée / payée / en retard), filtres par type, note d'intégration e-facture / TTN.

### Trésorerie
- **`src/pages/admin/AdminTreasury.tsx`** (route `/admin/treasury`) — UI à onglets : Comptes (caisse + banques avec RIB), Mouvements (entrées/sorties), Chèques & traites (portefeuille / remis / encaissé / impayé), Échéancier (effets à venir). KPIs trésorerie totale, caisse, banques, effets en portefeuille.

### RH & Paie
- **`src/pages/admin/AdminHr.tsx`** (route `/admin/hr`) — UI à onglets : Employés (contrats CDI/CDD/SIVP/stage), Congés (annuel / maladie / sans solde / maternité), Paie. Bulletin de paie détaillé avec calcul **CNSS salariale 9,18 %**, **CNSS patronale 16,57 %** et **IRPP progressif** (barème 0 / 26 / 28 / 32 / 35 %). Tiroir animé (framer-motion).

### Navigation & i18n
- **Navigation** — section « Gestion commerciale » élargie (devis, factures, bons de commande, bons de livraison, règlements) + 3 nouvelles sections dans `AdminLayout.tsx` : « Comptabilité & Fiscalité », « Trésorerie », « RH & Paie ». Protégées par les rôles `SUPER_ADMIN / BRANCH_ADMIN / ACCOUNTANT` et les permissions dédiées.
- **i18n** — clés complètes ajoutées (`fr.json` + `en.json`) : `adminPurchaseOrders`, `adminDeliveryNotes`, `adminPayments`, `adminAccounting`, `adminTax`, `adminTreasury`, `adminHr` + libellés de navigation et sections.
- **Calculs fiscaux tunisiens intégrés** : TVA 19 %, timbre fiscal 1,000 TND, retenue à la source 1,5 %, FODEC 1 %, TEJ 0,2 %, CNSS 9,18 % / 16,57 %, IRPP progressif.

### Vérifications
- `tsc --noEmit` : ✅ sans erreur.
- `npm run build` : ✅ build production réussi.
- JSON i18n (`fr` / `en`) : ✅ parsés sans erreur.

## Prochaines étapes (backend + suite fonctionnelle)
1. **Brancher l'API** — remplacer les données mock de tous les modules par des fonctions dédiées dans `src/api.ts` (`getAdminQuotes`, `getAdminInvoices`, `getAdminPurchaseOrders`, `getAdminDeliveryNotes`, `getAdminPayments`, `getAdminAccounting`, `getAdminTax`, `getAdminTreasury`, `getAdminHr`), calquées sur `getAdminOrders`.
2. **Permissions backend** — définir les constantes (`QUOTE_*`, `INVOICE_*`, `PURCHASE_*`, `DELIVERY_*`, `PAYMENT_*`, `ACCOUNTING_*`, `TAX_*`, `TREASURY_*`, `HR_*`) dans `AccessRules` côté serveur, sinon la navigation par permission (hors rôle) ne s'affiche pas.
3. **Formulaires de création/édition** — les pages sont actuellement en lecture seule ; ajouter les modales de saisie (réutiliser `Modal` / `ModalFooterButtons` de `_ui.tsx`).
4. **Modules restants (nécessitent backend)** — lettrage, bilan / état de résultat, rapprochement bancaire, pointage RH, télédéclaration e-facture TTN/TEIF.
5. **Liaisons inter-modules** — factures ↔ règlements ↔ trésorerie ↔ comptabilité (génération automatique d'écritures), bons de livraison ↔ factures.

