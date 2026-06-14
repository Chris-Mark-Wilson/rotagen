import  { useState, useEffect } from "react";

export const HolidayModal = ({ open, onClose, personId }) => {
  const [holidays, setHolidays] = useState([]);
  const [newHoliday, setNewHoliday] = useState("");

  useEffect(() => {
    if (!open) {
      setHolidays([]);
      setNewHoliday("");

    } else {
      // Fetch holidays for the person when the modal opens
   
    }
    }, [open, personId]);

    return (
      <div>
        {open && (
          <div className="modal">
            <h2>Holidays for Person ID: {personId}</h2>
            <ul>
              {holidays.map((holiday, index) => (
                <li key={index}>{holiday}</li>
              ))}
            </ul>
            <input
              type="date"
              value={newHoliday}
              onChange={(e) => setNewHoliday(e.target.value)}
            />
            <button onClick={() => {
              // Add new holiday logic here
            }}>Add Holiday</button>
            <button onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    );
  };

