# Vector editor · Editor de vectores

Simulador de clonación en el navegador: elige enzimas de restricción comerciales o propias, digiere vector e inserto, liga, y obtén en vivo el FASTA y el mapa circular del plásmido resultante.
*In-browser cloning simulator: choose commercial or custom restriction enzymes, digest vector and insert, ligate, and get a live FASTA and circular map of the resulting plasmid.*

**Usarlo / Use it:** [oquinterol.com/es/tools/vector-editor](https://oquinterol.com/es/tools/vector-editor/) · [oquinterol.com/en/tools/vector-editor](https://oquinterol.com/en/tools/vector-editor/)

> **Estado / Status: prototipo / prototype.** Verifica los resultados antes de usarlos en el laboratorio. / Check results before using them at the bench.

[Español](#español) · [English](#english)

## Español

- **568 enzimas comerciales** de REBASE con proveedores (NEB, Thermo Fisher, Promega, Takara…), filtrables por proveedor y por si cortan vector e inserto.
- **Enzimas propias** en notación REBASE: `G^AATTC`, `G^AATT_C` (corte explícito en la hebra inferior) o `GGTCTC(1/5)` (tipo IIS).
- **Sitios en ambas hebras**, códigos IUPAC y sitios que cruzan el origen del plásmido.
- **Digestión y ligación** con extremos reales (5', 3' o romos): comprueba la compatibilidad de ambas uniones, prueba las dos orientaciones del inserto y avisa si el vector puede religarse o si las enzimas cortan dentro del inserto. Funciona con enzimas tipo IIS (Golden Gate).
- **Archivos**: FASTA, GenBank y SnapGene (`.dna`), leídos localmente con [seqparse](https://github.com/Lattice-Automation/seqparse).
- **Mapa y FASTA vinculados**: el FASTA se colorea igual que el mapa circular ([SeqViz](https://github.com/Lattice-Automation/seqviz)) — vector, inserto y sitios de corte —; seleccionar bases en el FASTA marca el arco en el mapa, hacer clic en el mapa o en la leyenda resalta y lleva a esa secuencia. Copia o descarga el FASTA completo o solo la selección.
- **Búsqueda de enzimas** en un desplegable con teclado (↑ ↓ Enter Esc), filtrable por proveedor y por si cortan vector e inserto.
- **Privado**: todo corre en el navegador; las secuencias no se envían a ningún servidor.

## English

- **568 commercial enzymes** from REBASE with suppliers (NEB, Thermo Fisher, Promega, Takara…), filterable by supplier and by whether they cut the vector and insert.
- **Custom enzymes** in REBASE notation: `G^AATTC`, `G^AATT_C` (explicit bottom-strand cut) or `GGTCTC(1/5)` (type IIS).
- **Sites on both strands**, IUPAC codes, and sites spanning the plasmid origin.
- **Digestion and ligation** with real ends (5', 3' or blunt): checks both junctions, tries both insert orientations, and warns when the vector can self-ligate or the enzymes cut inside the insert. Works with type IIS enzymes (Golden Gate).
- **Files**: FASTA, GenBank and SnapGene (`.dna`), parsed locally with [seqparse](https://github.com/Lattice-Automation/seqparse).
- **Linked map and FASTA**: the FASTA is coloured like the circular map ([SeqViz](https://github.com/Lattice-Automation/seqviz)) — vector, insert and cut sites —; selecting bases in the FASTA marks the arc on the map, and clicking the map or the legend highlights and scrolls to that sequence. Copy or download the whole FASTA or just the selection.
- **Enzyme search** in a keyboard-friendly dropdown (↑ ↓ Enter Esc), filterable by supplier and by whether enzymes cut vector and insert.
- **Private**: everything runs in the browser; sequences are never sent to a server.

## Uso como librería / Library use

```tsx
import { VectorEditor, labelsEs } from '@oquinterol/vector-editor'
import '@oquinterol/vector-editor/styles.css'

<VectorEditor labels={labelsEs} />
```

El núcleo (sin React) está en `@oquinterol/vector-editor/core`: `findCuts`, `digest`, `ligate`, `parseEnzyme`, `toFasta`…
*The React-free core is in `@oquinterol/vector-editor/core`.*

## Desarrollo / Development

```bash
pnpm install
pnpm test        # núcleo con pruebas / tested core (vitest)
pnpm build       # dist/
pnpm enzymes     # regenerar el catálogo desde REBASE / rebuild the catalogue from REBASE
```

## Se apoya en / Builds on

| Proyecto / Project | Licencia / Licence | Para qué / What for |
|---|---|---|
| [SeqViz](https://github.com/Lattice-Automation/seqviz) | MIT | Mapa circular / Circular map |
| [seqparse](https://github.com/Lattice-Automation/seqparse) | MIT | Lectura de GenBank y SnapGene / GenBank and SnapGene parsing |
| [REBASE](http://rebase.neb.com) | © R. J. Roberts — ver / see [`DATA_NOTICE.md`](DATA_NOTICE.md) | Enzimas comerciales / Commercial enzymes |

## Licencia / Licence

Código: [MIT](LICENSE). Datos de enzimas: ver / see [`DATA_NOTICE.md`](DATA_NOTICE.md). Cómo citar / How to cite: [`CITATION.cff`](CITATION.cff).
