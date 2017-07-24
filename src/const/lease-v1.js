module.exports = {
  DEPOSIT_REFUND_DELAYS: {
    basic:     60,
    comfort:   40,
    privilege: 20,
  },
  SERVICE_FEES: {
    1:                   5000, // 1 room
    2:                   4000, // 2 rooms
    default:             3000, // 3 or more rooms
  },
  LATE_NOTICE_FEES: {
    '0-9days':          67900,
    '10-19days':        47900,
    '20-29days':        27900,
  },
  ROOM_SWITCH_FEES: {
    privilege:              0,
    comfort:            19000,
    basic:              29000,
  },
  LATE_PAYMENT_FEES:     1000,
  SPECIAL_CHECKIN_FEES:  7900,
  UNCASHED_DEPOSIT_FEES: 2900,
};
