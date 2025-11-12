import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule, NgIf, NgForOf } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DataService, Escuela, Carrera } from '../../services/data.service';
import * as XLSX from 'xlsx';
import { Router } from '@angular/router';
import { ConfirmModalComponent } from '../shared/confirm-modal/confirm-modal.component';
import { ConfirmModalService } from '../../services/confirm-modal.service';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [CommonModule, NgIf, NgForOf, ReactiveFormsModule, RouterModule, ConfirmModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  userName: string | null = null;

  // right menu state: 'escuela' | 'carrera' | null
  active: 'escuela' | 'carrera' | null = null;

  escuelaForm!: FormGroup;
  carreraForm!: FormGroup;
  // search & filters
  searchTerm = '';
  carFilterEscuelaId = '';
  showOnlyWithCarreras = false;

  displayedEscuelas: Escuela[] = [];
  displayedCarreras: Carrera[] = [];
  carreraLogoPreview: string | null = null;

  escuelas: Escuela[] = [];
  carreras: Carrera[] = [];

  message = '';
  logoPreview: string | null = null;
  selectedEscuelaId: string | null = null;
  selectedCarreraId: string | null = null;
  // multi-selection sets (support ctrl/cmd + click)
  selectedEscuelaIds: Set<string> = new Set();
  selectedCarreraIds: Set<string> = new Set();
  editMode = false;
  editModeCarrera = false;
  // context menu state
  contextMenuVisible = false;
  contextMenuX = 0;
  contextMenuY = 0;
  contextMenuTarget: { type: 'escuela' | 'carrera'; id?: string | null } | null = null;
  showConfirm = false;
  confirmMessage = '';
  importing = false;
  // drag state for import areas
  draggingEscuela = false;
  draggingCarrera = false;

  constructor(private auth: AuthService, private data: DataService, private fb: FormBuilder, private router: Router, private confirmSvc: ConfirmModalService) {}

  ngOnInit(): void {
    this.userName = this.auth.currentUserName();
    this.escuelas = this.data.getEscuelas();
    this.carreras = this.data.getCarreras();

    this.escuelaForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      cct: [''],
      telefono: [''],
      extension: [''],
      correo: [''],
      representanteNombre: [''],
      representantePuesto: [''],
      direccion: [''],
      logo: [''],
      pagina: ['']
    });

    this.carreraForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      code: [''],
      escuelaId: [''],
      studentsCount: [0],
      logo: ['']
    });

    // initial filtered lists
    this.applyFilters();
  }

  // file import handlers
  onEscuelasFileChange(evt: Event) {
    const input = evt.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.parseExcelFile(file, 'escuela');
  }

  onCarrerasFileChange(evt: Event) {
    const input = evt.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.parseExcelFile(file, 'carrera');
  }

  onDropFiles(event: DragEvent, type: 'escuela' | 'carrera') {
    event.preventDefault();
    const dt = event.dataTransfer;
    if (!dt || !dt.files || dt.files.length === 0) return;
    const file = dt.files[0];
    this.parseExcelFile(file, type);
  }

  private parseExcelFile(file: File, type: 'escuela' | 'carrera') {
    this.importing = true;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('Empty file');
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (type === 'escuela') this.importEscuelas(rows);
        else this.importCarreras(rows);
      } catch (err) {
        console.error('Error parsing file', err);
        this.message = 'Error al procesar el archivo.';
      } finally {
        this.importing = false;
        this.refreshData();
        this.applyFilters();
      }
    };
    reader.onerror = () => {
      this.message = 'Error leyendo el archivo.';
      this.importing = false;
    };
    reader.readAsArrayBuffer(file);
  }

  private normalizeKey(k: string) {
    // Convert camelCase to snake_case, trim, lower-case, convert spaces to underscores
    // and remove any non-word characters to produce stable keys for mapping.
    if (!k) return '';
    const s = k.toString().trim()
      // insert underscore between lower->Upper boundaries: puestoRepresentante -> puesto_Representante
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      // replace spaces/tabs/newlines with underscore
      .replace(/\s+/g, '_')
      // remove any characters that are not word chars or underscore
      .replace(/[^\w_]/g, '');
    return s.toLowerCase();
  }

  private importEscuelas(rows: any[]) {
    let added = 0;
    for (const r of rows) {
      const map: any = {};
      for (const key of Object.keys(r)) {
        map[this.normalizeKey(key)] = r[key];
      }
      const payload: any = {
        nombre: map['nombre'] || map['nombre_institucion'] || map['institucion'] || map['school'] || '',
        cct: map['cct'] || map['cct'] || '',
        telefono: map['telefono'] || map['phone'] || '',
        extension: map['extension'] || '',
        correo: map['correo'] || map['email'] || '',
        representanteNombre: map['representante'] || map['representante_nombre'] || map['director'] || '',
        representantePuesto: map['representante_puesto'] || '',
        direccion: map['direccion'] || map['address'] || '',
        logo: '',
        pagina: map['pagina'] || map['website'] || ''
      };
      // set the current user as encargadoRegistro when importing
      payload.encargadoRegistro = this.auth.currentUserName() || '';
      if (payload.nombre) {
        this.data.addEscuela(payload);
        added++;
      }
    }
    this.message = `Se importaron ${added} escuelas.`;
  }

  private importCarreras(rows: any[]) {
    let added = 0;
    for (const r of rows) {
      const map: any = {};
      for (const key of Object.keys(r)) {
        map[this.normalizeKey(key)] = r[key];
      }
      // try to resolve escuelaId by name if provided
      let escuelaId = map['escuelaid'] || map['escuela_id'] || map['escuela'] || map['escuelanombre'] || '';
      if (escuelaId && typeof escuelaId === 'string') {
        const found = this.escuelas.find(e => (e.nombre || '').toLowerCase() === escuelaId.toLowerCase());
        if (found) escuelaId = found.id;
      }
      const payload: any = {
        name: map['name'] || map['nombre'] || map['carrera'] || '',
        code: map['code'] || map['codigo'] || map['id'] || '',
        escuelaId: escuelaId || '',
        studentsCount: Number(map['studentscount'] || map['alumnos'] || 0) || 0,
        logo: ''
      };
      if (payload.name) {
        this.data.addCarrera(payload);
        added++;
      }
    }
    this.message = `Se importaron ${added} carreras.`;
  }

  // drag handlers to toggle visual state
  onImportDragEnter(type: 'escuela' | 'carrera') {
    if (type === 'escuela') this.draggingEscuela = true;
    if (type === 'carrera') this.draggingCarrera = true;
  }

  onImportDragLeave(type: 'escuela' | 'carrera') {
    if (type === 'escuela') this.draggingEscuela = false;
    if (type === 'carrera') this.draggingCarrera = false;
  }

  getEscuelaNombre(id?: string) {
    if (!id) return '-';
    const s = this.escuelas.find(s => s.id === id);
    return s ? s.nombre : '-';
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  open(side: 'escuela' | 'carrera') {
    this.active = side;
    this.message = '';
  }

  closeMenus() {
    this.active = null;
    this.message = '';
    this.editMode = false;
    this.selectedEscuelaId = null;
  }

  saveEscuela() {
    if (this.escuelaForm.invalid) return;
    const encargado = this.auth.currentUserName() || '';
    const payload = { ...(this.escuelaForm.value as any), encargadoRegistro: encargado };
    if (this.editMode && this.selectedEscuelaId) {
      const ok = this.data.updateEscuela(this.selectedEscuelaId, payload);
      this.message = ok ? 'Escuela actualizada' : 'Error actualizando escuela';
    } else {
      const id = this.data.addEscuela(payload);
      this.message = 'Escuela registrada (id: ' + id + ')';
    }
    this.refreshData();
    this.escuelaForm.reset();
    this.logoPreview = null;
    this.active = null;
    this.editMode = false;
    this.selectedEscuelaId = null;
    this.applyFilters();
  }

  selectEscuela(id: string) {
    // ensure data is normalized (adds missing ids) before selecting
    this.refreshData();
    console.log('selectEscuela clicked id:', id);
    console.log('visible escuela ids:', this.displayedEscuelas.map(d => d.id));
    this.selectedEscuelaId = id;
    // deselect carrera when selecting escuela
    this.selectedCarreraId = null;
  }

  // safer selection by index (used from table row clicks) to avoid stale/undefined ids
  selectEscuelaByIndex(index: number, event?: Event | MouseEvent) {
    const item = this.displayedEscuelas[index];
    const id = item?.id;
    console.log('selectEscuelaByIndex', index, id);
    if (!id) {
      return;
    }
    // detect if the event came from a checkbox change
    const isCheckboxEvent = !!(event && event.target && (event.target as HTMLInputElement).type === 'checkbox');
    if (isCheckboxEvent) {
      const checked = !!((event!.target as HTMLInputElement).checked);
      if (checked) this.selectedEscuelaIds.add(id);
      else this.selectedEscuelaIds.delete(id);
      this.selectedEscuelaId = this.selectedEscuelaIds.size ? Array.from(this.selectedEscuelaIds)[0] : null;
      // do not clear carreras when toggling checkboxes
      return;
    }

    const multi = !!(event && ('ctrlKey' in (event as MouseEvent) ? (event as MouseEvent).ctrlKey || (event as MouseEvent).metaKey : false));
    if (multi) {
      if (this.selectedEscuelaIds.has(id)) this.selectedEscuelaIds.delete(id);
      else this.selectedEscuelaIds.add(id);
      this.selectedEscuelaId = id;
    } else {
      this.selectedEscuelaIds = new Set([id]);
      this.selectedEscuelaId = id;
    }
    // clear carrera selection when selecting escuela normally
    this.selectedCarreraIds.clear();
    this.selectedCarreraId = null;
  }

  selectCarrera(id: string) {
    // ensure data is normalized (adds missing ids) before selecting
    this.refreshData();
    console.log('selectCarrera clicked id:', id);
    console.log('visible carrera ids:', this.displayedCarreras.map(d => d.id));
    this.selectedCarreraId = id;
    // deselect escuela when selecting carrera
    this.selectedEscuelaId = null;
  }

  selectCarreraByIndex(index: number, event?: Event | MouseEvent) {
    const item = this.displayedCarreras[index];
    const id = item?.id;
    console.log('selectCarreraByIndex', index, id);
    if (!id) return;
    const isCheckboxEvent = !!(event && event.target && (event.target as HTMLInputElement).type === 'checkbox');
    if (isCheckboxEvent) {
      const checked = !!((event!.target as HTMLInputElement).checked);
      if (checked) this.selectedCarreraIds.add(id);
      else this.selectedCarreraIds.delete(id);
      this.selectedCarreraId = this.selectedCarreraIds.size ? Array.from(this.selectedCarreraIds)[0] : null;
      return;
    }

    const isMulti = !!(event && ('ctrlKey' in (event as MouseEvent) ? (event as MouseEvent).ctrlKey || (event as MouseEvent).metaKey : false));
    if (isMulti) {
      if (this.selectedCarreraIds.has(id)) this.selectedCarreraIds.delete(id);
      else this.selectedCarreraIds.add(id);
      this.selectedCarreraId = id;
    } else {
      this.selectedCarreraIds = new Set([id]);
      this.selectedCarreraId = id;
    }
    // clear escuela selection when selecting carrera normally
    this.selectedEscuelaIds.clear();
    this.selectedEscuelaId = null;
  }

  // delete multiple selected escuelas
  async deleteSelectedEscuelas() {
    const count = this.selectedEscuelaIds.size;
    if (count === 0) return;
    const msg = count === 1 ? '¿Seguro que deseas eliminar la escuela seleccionada? Esta acción no se puede deshacer.' : `¿Seguro que deseas eliminar ${count} escuelas seleccionadas? Esta acción no se puede deshacer.`;
    const confirmed = await this.confirmSvc.open(msg, 'Eliminar escuelas');
    if (!confirmed) return;
    for (const id of Array.from(this.selectedEscuelaIds)) {
      this.data.deleteEscuela(id);
    }
    this.refreshData();
    this.message = count === 1 ? 'Escuela eliminada' : `${count} escuelas eliminadas`;
    this.selectedEscuelaIds.clear();
    this.selectedEscuelaId = null;
  }

  // delete multiple selected carreras
  async deleteSelectedCarreras() {
    const count = this.selectedCarreraIds.size;
    if (count === 0) return;
    const msg = count === 1 ? '¿Seguro que deseas eliminar la carrera seleccionada? Esta acción no se puede deshacer.' : `¿Seguro que deseas eliminar ${count} carreras seleccionadas? Esta acción no se puede deshacer.`;
    const confirmed = await this.confirmSvc.open(msg, 'Eliminar carreras');
    if (!confirmed) return;
    for (const id of Array.from(this.selectedCarreraIds)) {
      this.data.deleteCarrera(id);
    }
    this.refreshData();
    this.message = count === 1 ? 'Carrera eliminada' : `${count} carreras eliminadas`;
    this.selectedCarreraIds.clear();
    this.selectedCarreraId = null;
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(e: KeyboardEvent) {
    const key = e.key || '';
    if (key === 'Delete' || key === 'Del' || key.toLowerCase() === 'supr') {
      if (this.selectedEscuelaIds.size > 0) {
        this.deleteSelectedEscuelas();
        e.preventDefault();
      } else if (this.selectedCarreraIds.size > 0) {
        this.deleteSelectedCarreras();
        e.preventDefault();
      }
    }
  }

  // trackBy functions to help Angular keep row identity
  trackByEscuela(index: number, item: Escuela) {
    // return a stable fallback id if item.id is missing
    return item?.id || `escuela-${index}`;
  }

  trackByCarrera(index: number, item: Carrera) {
    // return a stable fallback id if item.id is missing
    return item?.id || `carrera-${index}`;
  }

  // helpers for multi-selection UI
  isSelectedEscuela(id?: string) {
    if (!id) return false;
    return this.selectedEscuelaIds.has(id);
  }

  isSelectedCarrera(id?: string) {
    if (!id) return false;
    return this.selectedCarreraIds.has(id);
  }

  toggleSelectAllEscuelas(event: Event) {
    const checked = !!((event.target as HTMLInputElement).checked);
    if (checked) {
      this.selectedEscuelaIds = new Set(this.displayedEscuelas.map(e => e.id).filter(Boolean) as string[]);
      this.selectedEscuelaId = this.selectedEscuelaIds.size ? Array.from(this.selectedEscuelaIds)[0] : null;
    } else {
      this.selectedEscuelaIds.clear();
      this.selectedEscuelaId = null;
    }
    // clear carreras selection when changing escuela selection
    this.selectedCarreraIds.clear();
    this.selectedCarreraId = null;
  }

  toggleSelectAllCarreras(event: Event) {
    const checked = !!((event.target as HTMLInputElement).checked);
    if (checked) {
      this.selectedCarreraIds = new Set(this.displayedCarreras.map(c => c.id).filter(Boolean) as string[]);
      this.selectedCarreraId = this.selectedCarreraIds.size ? Array.from(this.selectedCarreraIds)[0] : null;
    } else {
      this.selectedCarreraIds.clear();
      this.selectedCarreraId = null;
    }
    // clear escuelas selection when changing carrera selection
    this.selectedEscuelaIds.clear();
    this.selectedEscuelaId = null;
  }

  // show custom context menu
  onRowContextMenu(event: MouseEvent, type: 'escuela' | 'carrera', id?: string) {
    event.preventDefault();
    this.contextMenuVisible = true;
    this.contextMenuX = event.clientX;
    this.contextMenuY = event.clientY;
    this.contextMenuTarget = { type, id };
    // if right-click selects the row, update selection
    if (type === 'escuela' && id) this.selectEscuela(id);
    if (type === 'carrera' && id) this.selectCarrera(id);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: Event) {
    // hide context menu on any click outside
    if (this.contextMenuVisible) {
      this.contextMenuVisible = false;
      this.contextMenuTarget = null;
    }
  }


  // Context menu actions
  contextAdd(type: 'escuela' | 'carrera') {
    this.contextMenuVisible = false;
    this.contextMenuTarget = null;
    this.open(type);
  }

  contextEdit() {
    if (!this.contextMenuTarget) return;
    const { type, id } = this.contextMenuTarget;
    this.contextMenuVisible = false;
    if (type === 'escuela' && id) {
      this.selectedEscuelaId = id;
      this.startEditSelected();
    }
    if (type === 'carrera' && id) {
      this.selectedCarreraId = id;
      this.startEditSelectedCarrera();
    }
  }

  contextDelete() {
    if (!this.contextMenuTarget) return;
    const { type, id } = this.contextMenuTarget;
    this.contextMenuVisible = false;
    if (type === 'escuela' && id) {
      this.selectedEscuelaId = id;
      this.deleteSelected();
    }
    if (type === 'carrera' && id) {
      this.selectedCarreraId = id;
      this.deleteSelectedCarrera();
    }
  }

  startEditSelected() {
    if (!this.selectedEscuelaId) return;
    const s = this.escuelas.find(x => x.id === this.selectedEscuelaId);
    if (!s) return;
    this.escuelaForm.patchValue({
      nombre: s.nombre || '',
      cct: s.cct || '',
      telefono: s.telefono || '',
      extension: s.extension || '',
      correo: s.correo || '',
      representanteNombre: s.representanteNombre || '',
      representantePuesto: s.representantePuesto || '',
      direccion: s.direccion || '',
      logo: s.logo || '',
      pagina: s.pagina || ''
    });
    this.logoPreview = s.logo || null;
    this.editMode = true;
    this.open('escuela');
  }

  startEditSelectedCarrera() {
    if (!this.selectedCarreraId) return;
    const c = this.carreras.find(x => x.id === this.selectedCarreraId);
    if (!c) return;
    this.carreraForm.patchValue({
      name: c.name || '',
      code: c.code || '',
      escuelaId: c.escuelaId || '',
      studentsCount: c.studentsCount ?? 0,
      logo: c.logo || ''
    });
    this.carreraLogoPreview = c.logo || null;
    this.editModeCarrera = true;
    this.open('carrera');
  }

  deleteSelected() {
    if (!this.selectedEscuelaId) return;
    const s = this.escuelas.find(x => x.id === this.selectedEscuelaId);
    const name = s ? s.nombre : this.selectedEscuelaId;
    // use ConfirmModalService to open modal and wait for result
    this.confirmSvc.open(`¿Seguro que deseas eliminar la escuela "${name}"? Esta acción no se puede deshacer.`, 'Eliminar escuela')
      .then(confirmed => {
        if (!confirmed) return;
        this.data.deleteEscuela(this.selectedEscuelaId as string);
        this.refreshData();
        this.message = 'Escuela eliminada';
        this.selectedEscuelaId = null;
        if (this.editMode) {
          this.editMode = false;
          this.active = null;
          this.escuelaForm.reset();
          this.logoPreview = null;
        }
      });
  }

  deleteSelectedCarrera() {
    if (!this.selectedCarreraId) return;
    const c = this.carreras.find(x => x.id === this.selectedCarreraId);
    const name = c ? c.name : this.selectedCarreraId;
    this.confirmSvc.open(`¿Seguro que deseas eliminar la carrera "${name}"? Esta acción no se puede deshacer.`, 'Eliminar carrera')
      .then(confirmed => {
        if (!confirmed) return;
        this.data.deleteCarrera(this.selectedCarreraId as string);
        this.refreshData();
        this.message = 'Carrera eliminada';
        this.selectedCarreraId = null;
        if (this.editModeCarrera) {
          this.editModeCarrera = false;
          this.active = null;
          this.carreraForm.reset();
          this.carreraLogoPreview = null;
        }
      });
  }

  performDeleteConfirmed() {
    if (!this.selectedEscuelaId) return;
    this.data.deleteEscuela(this.selectedEscuelaId);
    this.refreshData();
    this.message = 'Escuela eliminada';
    this.selectedEscuelaId = null;
    if (this.editMode) {
      this.editMode = false;
      this.active = null;
      this.escuelaForm.reset();
      this.logoPreview = null;
    }
    this.showConfirm = false;
    this.confirmMessage = '';
  }

  saveCarrera() {
    if (this.carreraForm.invalid) return;
    const payload = { ...(this.carreraForm.value as any) };
    // ensure numeric
    if (payload.studentsCount !== undefined) payload.studentsCount = Number(payload.studentsCount) || 0;
    if (this.editModeCarrera && this.selectedCarreraId) {
      const ok = this.data.updateCarrera(this.selectedCarreraId, payload);
      this.carreras = this.data.getCarreras();
      this.message = ok ? 'Carrera actualizada' : 'Error actualizando carrera';
      // reset edit state
      this.editModeCarrera = false;
      this.active = null;
      this.selectedCarreraId = null;
    } else {
      const id = this.data.addCarrera(payload);
      this.carreras = this.data.getCarreras();
      this.message = 'Carrera registrada (id: ' + id + ')';
    }
    this.carreraForm.reset();
    this.carreraLogoPreview = null;
    this.applyFilters();
  }

  // JSON import/export (without logos)
  onJsonFileChange(evt: Event) {
    const input = evt.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const txt = reader.result as string;
        const parsed = JSON.parse(txt);
        // expect { escuelas: [...], carreras: [...] }
        if (!parsed || (typeof parsed !== 'object')) {
          this.message = 'Archivo JSON inválido.';
          return;
        }
        this.data.setAll({ escuelas: parsed.escuelas || [], carreras: parsed.carreras || [] }, { stripLogos: true });
        this.refreshData();
        this.message = 'Datos importados desde JSON (logos omitidos).';
      } catch (err) {
        console.error('Error importando JSON', err);
        this.message = 'Error al importar JSON.';
      }
    };
    reader.onerror = () => {
      this.message = 'Error leyendo el archivo.';
    };
    reader.readAsText(file);
    // clear the input value so same file can be reselected later
    input.value = '';
  }

  exportJsonNoLogos() {
    const data = this.data.exportAllWithoutLogos();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crm-data-no-logos.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  exportJson() {
    const data = this.data.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crm-data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  refreshData() {
    this.escuelas = this.data.getEscuelas();
    this.carreras = this.data.getCarreras();
    this.message = '';
    this.applyFilters();
  }

  applyFilters() {
    const s = (this.searchTerm || '').trim().toLowerCase();
    // escuelas
    this.displayedEscuelas = this.escuelas.filter(e => {
      // if filtering to only escuelas that have carreras, check carreras list
      if (this.showOnlyWithCarreras) {
        const tiene = this.carreras.some(c => c.escuelaId === e.id);
        if (!tiene) return false;
      }
      if (!s) return true;
      const hay = (e.nombre || '') + ' ' + (e.cct || '') + ' ' + (e.representanteNombre || '');
      return hay.toLowerCase().includes(s);
    });
    // carreras
    this.displayedCarreras = this.carreras.filter(c => {
      if (this.carFilterEscuelaId && this.carFilterEscuelaId !== '') {
        if (c.escuelaId !== this.carFilterEscuelaId) return false;
      }
      if (!s) return true;
      const hay = (c.name || '') + ' ' + (c.code || '');
      return hay.toLowerCase().includes(s);
    });
  }

  onLogoFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.readFileAsBase64(file).then(b64 => {
      if (b64) {
        // set form control value to base64 string
        this.escuelaForm.patchValue({ logo: b64 });
        this.logoPreview = b64;
      }
    });
  }

  onCarreraLogoChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.readFileAsBase64(file).then(b64 => {
      if (b64) {
        this.carreraForm.patchValue({ logo: b64 });
        this.carreraLogoPreview = b64;
      }
    });
  }

  private readFileAsBase64(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string | ArrayBuffer | null;
        if (!result) return resolve(null);
        if (typeof result === 'string') return resolve(result);
        // ArrayBuffer -> convert
        const bytes = new Uint8Array(result as ArrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        resolve('data:' + file.type + ';base64,' + btoa(binary));
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }
}
