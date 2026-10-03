# Datos de enzimas · Enzyme data

`src/data/enzymes.json` se genera con `pnpm enzymes` a partir de los archivos EMBOSS de **REBASE** (`link_emboss_e`, `link_emboss_r`, `link_emboss_s`), que REBASE distribuye sin costo para su uso en software de análisis de secuencias. Solo se conservan enzimas con proveedor comercial y dos posiciones de corte conocidas.
*`src/data/enzymes.json` is generated with `pnpm enzymes` from the **REBASE** EMBOSS files, which REBASE distributes at no charge for use in sequence-analysis software. Only enzymes with a commercial supplier and two known cut positions are kept.*

- Fuente / Source: REBASE, The Restriction Enzyme Database — http://rebase.neb.com
- Copyright (c) Dr. Richard J. Roberts. Los datos de REBASE **no** están cubiertos por la licencia MIT de este repositorio. / REBASE data is **not** covered by this repository's MIT licence.
- Cita / Cite: Roberts, R. J., Vincze, T., Posfai, J., & Macelis, D. (2023). REBASE in 2023: a database for enzymes and regulatory functions. *Nucleic Acids Research*, 51(D1), D629–D630. https://doi.org/10.1093/nar/gkac975

## Secuencias de ejemplo · Example sequences

- pUC19: GenBank [L09137.2](https://www.ncbi.nlm.nih.gov/nuccore/L09137.2).
- StSP6A CDS: RefSeq [NM_001287968.1](https://www.ncbi.nlm.nih.gov/nuccore/NM_001287968.1), con sitios KpnI y XbaI añadidos en los extremos solo para el ejemplo / with KpnI and XbaI sites added at the ends for the example only.
