import locale
from fpdf import FPDF
from datetime import date, timedelta
from typing import List, Dict, Any
import calendar

class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 12)
        # Assuming we will pass month and year to header
        # self.cell(0, 10, f'Turni Guardia {self.month_name} {self.year}', 0, 1, 'C')
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

def generate_schedule_pdf(
    doctors: List[Dict[str, Any]], 
    shifts: List[Dict[str, Any]], 
    year: int, 
    month: int,
    holidays: List[date]
) -> bytes:
    """
    Generates a PDF of the schedule for the given month and year.
    The table has days as rows and shift types as columns, with row coloring.
    """
    
    # Set locale to Italian for month/day names
    try:
        locale.setlocale(locale.LC_TIME, 'it_IT.UTF-8')
    except locale.Error:
        print("Warning: Italian locale 'it_IT.UTF-8' not available. Using default locale.")

    # Convert input dicts to internal objects for easier access
    doctor_map = {d['doctor_id']: d['nome'] for d in doctors}

    # Group shifts by date and new categories
    shifts_by_date: Dict[date, Dict[str, List[str]]] = {}
    for s in shifts:
        shift_date = s['shift_date']
        if shift_date not in shifts_by_date:
            shifts_by_date[shift_date] = {
                'GIORNO_FESTIVO': [], 
                'NOTTE_FESTIVO': [], 
                'FERIALE_SERALE': []
            }
        
        stype = s['shift_type']
        if stype in ('sabato_giorno', 'domenica_giorno', 'festivo_giorno'):
            shifts_by_date[shift_date]['GIORNO_FESTIVO'].extend(s['assigned_doctor_ids'])
        elif stype in ('sabato_notte', 'domenica_notte', 'festivo_notte'):
            shifts_by_date[shift_date]['NOTTE_FESTIVO'].extend(s['assigned_doctor_ids'])
        elif stype == 'feriale_serale':
            shifts_by_date[shift_date]['FERIALE_SERALE'].extend(s['assigned_doctor_ids'])
        else:
            print(f"Warning: Unhandled shift type '{s['shift_type']}'")

    # Initialize PDF in Portrait mode for vertical layout
    pdf = PDF('P', 'mm', 'A4')
    pdf.set_auto_page_break(auto=True, margin=15)

    month_name = date(year, month, 1).strftime('%B').capitalize()
    pdf.month_name = month_name
    pdf.year = str(year)

    pdf.add_page()
    pdf.set_font('Arial', 'B', 16)
    pdf.cell(0, 10, f'Turni Guardia {month_name} {year}', 0, 1, 'C')
    pdf.ln(5)

    pdf.set_font('Arial', '', 10)

    # Table Header
    pdf.set_fill_color(200, 220, 255)
    pdf.set_text_color(0)
    pdf.set_draw_color(0)
    pdf.set_line_width(0.3)
    
    col_widths = {'day': 30, 'giorno_festivo': 55, 'notte_festivo': 55, 'feriale_serale': 55}
    
    pdf.cell(col_widths['day'], 7, 'Giorno', 1, 0, 'C', 1)
    pdf.cell(col_widths['giorno_festivo'], 7, 'Giorno Festivo', 1, 0, 'C', 1)
    pdf.cell(col_widths['notte_festivo'], 7, 'Notte Festivo', 1, 0, 'C', 1)
    pdf.cell(col_widths['feriale_serale'], 7, 'Serale Feriale', 1, 0, 'C', 1)
    pdf.ln()

    # Table Data
    num_days = calendar.monthrange(year, month)[1]
    for day in range(1, num_days + 1):
        current_date = date(year, month, day)
        day_shifts = shifts_by_date.get(current_date, {
            'GIORNO_FESTIVO': [], 
            'NOTTE_FESTIVO': [], 
            'FERIALE_SERALE': []
        })

        is_holiday = current_date in holidays or current_date.weekday() == 6 # Sunday
        is_pre_holiday = (current_date + timedelta(days=1)) in holidays or current_date.weekday() == 5 # Saturday
        
        fill_row = False
        if is_holiday:
            pdf.set_fill_color(255, 255, 224) # Light yellow
            fill_row = True
        elif is_pre_holiday:
            pdf.set_fill_color(224, 255, 224) # Light green
            fill_row = True

        giorno_festivo_text = ", ".join([doctor_map.get(doc_id, doc_id) for doc_id in day_shifts.get('GIORNO_FESTIVO', [])])
        notte_festivo_text = ", ".join([doctor_map.get(doc_id, doc_id) for doc_id in day_shifts.get('NOTTE_FESTIVO', [])])
        feriale_serale_text = ", ".join([doctor_map.get(doc_id, doc_id) for doc_id in day_shifts.get('FERIALE_SERALE', [])])

        day_text = f"{current_date.strftime('%a').capitalize()} {day:02d}/{month:02d}"

        pdf.cell(col_widths['day'], 6, day_text, 1, 0, 'L', fill_row)
        pdf.cell(col_widths['giorno_festivo'], 6, giorno_festivo_text, 1, 0, 'L', fill_row)
        pdf.cell(col_widths['notte_festivo'], 6, notte_festivo_text, 1, 0, 'L', fill_row)
        pdf.cell(col_widths['feriale_serale'], 6, feriale_serale_text, 1, 0, 'L', fill_row)
        pdf.ln()

    return bytes(pdf.output())
