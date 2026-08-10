import { MemberCheckIn, Member } from '../types';
import { supabase, isSupabaseConfigured } from './mockSupabase';

const LOCAL_STORAGE_KEY = 'member_check_ins';

export class CheckInService {
  private getLocalCheckIns(): MemberCheckIn[] {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse local check-ins', e);
      return [];
    }
  }

  private saveLocalCheckIns(records: MemberCheckIn[]) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.error('Failed to save local check-ins', e);
    }
  }

  async getCheckIns(
    scopeId: string, 
    isProperty: boolean = false, 
    limitToOutletIds?: string[],
    filters?: { date?: string; memberId?: string; membershipNumber?: string; status?: 'active' | 'completed' }
  ): Promise<MemberCheckIn[]> {
    let checkIns: MemberCheckIn[] = [];

    if (isSupabaseConfigured()) {
      try {
        let query = supabase.from('member_check_ins').select('*');

        if (isProperty) {
          if (limitToOutletIds && limitToOutletIds.length > 0) {
            query = query.in('outlet_id', limitToOutletIds);
          } else {
            query = query.eq('property_id', scopeId);
          }
        } else if (scopeId && scopeId !== 'all') {
          query = query.eq('outlet_id', scopeId);
        }

        if (filters?.status) {
          query = query.eq('status', filters.status);
        }

        if (filters?.memberId && filters?.membershipNumber) {
          query = query.or(`member_id.eq.${filters.memberId},membership_number.eq.${filters.membershipNumber}`);
        } else if (filters?.memberId) {
          query = query.eq('member_id', filters.memberId);
        } else if (filters?.membershipNumber) {
          query = query.eq('membership_number', filters.membershipNumber);
        }

        if (filters?.date) {
          const startDate = `${filters.date}T00:00:00.000Z`;
          const endDate = `${filters.date}T23:59:59.999Z`;
          query = query.gte('check_in_time', startDate).lte('check_in_time', endDate);
        }

        const { data, error } = await query.order('check_in_time', { ascending: false });

        if (!error && data) {
          return data as MemberCheckIn[];
        }
      } catch (e) {
        console.warn('Supabase fetch check-ins error, falling back to local storage', e);
      }
    }

    // Local Storage Fallback
    const local = this.getLocalCheckIns();
    checkIns = local.filter(ci => {
      if (isProperty) {
        if (limitToOutletIds && limitToOutletIds.length > 0) {
          if (!limitToOutletIds.includes(ci.outlet_id)) return false;
        }
      } else if (scopeId && scopeId !== 'all') {
        if (ci.outlet_id !== scopeId) return false;
      }

      if (filters?.status && ci.status !== filters.status) return false;

      if (filters?.memberId || filters?.membershipNumber) {
        const matchId = filters.memberId && ci.member_id === filters.memberId;
        const matchNum = filters.membershipNumber && ci.membership_number?.toLowerCase() === filters.membershipNumber.toLowerCase();
        if (!matchId && !matchNum) return false;
      }

      if (filters?.date) {
        const checkInDate = ci.check_in_time.split('T')[0];
        if (checkInDate !== filters.date) return false;
      }

      return true;
    });

    return checkIns.sort((a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime());
  }

  async getCurrentlyCheckedIn(
    scopeId: string, 
    isProperty: boolean = false, 
    limitToOutletIds?: string[]
  ): Promise<MemberCheckIn[]> {
    return this.getCheckIns(scopeId, isProperty, limitToOutletIds, { status: 'active' });
  }

  async checkInMember(
    member: Member,
    method: MemberCheckIn['check_in_method'],
    checkedInBy?: string,
    notes?: string,
    outletId?: string
  ): Promise<{ success: boolean; checkIn?: MemberCheckIn; message: string }> {
    const targetOutletId = outletId || member.outlet_id || 'main';
    
    // First verify if member is already checked in
    const activeCheckIns = await this.getCheckIns(targetOutletId, false, undefined, { 
      memberId: member.id, 
      status: 'active' 
    });

    if (activeCheckIns.length > 0) {
      return {
        success: false,
        checkIn: activeCheckIns[0],
        message: `${member.guest_name} is already checked in since ${new Date(activeCheckIns[0].check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      };
    }

    const newRecord: MemberCheckIn = {
      id: 'ci_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      member_id: member.id,
      membership_number: member.membership_number,
      guest_name: member.guest_name,
      outlet_id: targetOutletId,
      check_in_time: new Date().toISOString(),
      check_out_time: null,
      duration_minutes: null,
      check_in_method: method,
      checked_in_by: checkedInBy || 'Reception Desk',
      notes: notes || '',
      status: 'active',
      membership_status_at_checkin: member.status,
      access_type: member.access_type || 'Both',
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('member_check_ins').insert([newRecord]);
        if (error) {
          console.warn('Supabase insert checkin error, saving locally:', error);
        }
      } catch (e) {
        console.warn('Supabase checkin error:', e);
      }
    }

    // Always keep local storage in sync
    const local = this.getLocalCheckIns();
    local.unshift(newRecord);
    this.saveLocalCheckIns(local);

    return {
      success: true,
      checkIn: newRecord,
      message: `Welcome ${member.guest_name}! Checked in successfully.`
    };
  }

  async checkOutMember(
    checkInId: string,
    notes?: string
  ): Promise<{ success: boolean; checkIn?: MemberCheckIn; message: string }> {
    const checkOutTime = new Date().toISOString();

    let recordToUpdate: MemberCheckIn | undefined;
    const local = this.getLocalCheckIns();
    const index = local.findIndex(c => c.id === checkInId);

    if (index !== -1) {
      recordToUpdate = local[index];
    }

    if (!recordToUpdate && isSupabaseConfigured()) {
      try {
        const { data } = await supabase.from('member_check_ins').select('*').eq('id', checkInId).single();
        if (data) recordToUpdate = data as MemberCheckIn;
      } catch (e) {}
    }

    if (!recordToUpdate) {
      return { success: false, message: 'Check-in record not found.' };
    }

    const startTime = new Date(recordToUpdate.check_in_time).getTime();
    const endTime = new Date(checkOutTime).getTime();
    const durationMinutes = Math.max(1, Math.round((endTime - startTime) / (1000 * 60)));

    const updatedRecord: MemberCheckIn = {
      ...recordToUpdate,
      check_out_time: checkOutTime,
      duration_minutes: durationMinutes,
      status: 'completed',
      notes: notes ? `${recordToUpdate.notes ? recordToUpdate.notes + ' | ' : ''}${notes}` : recordToUpdate.notes
    };

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('member_check_ins').update({
          check_out_time: checkOutTime,
          duration_minutes: durationMinutes,
          status: 'completed',
          notes: updatedRecord.notes
        }).eq('id', checkInId);
      } catch (e) {
        console.warn('Supabase update checkout error:', e);
      }
    }

    if (index !== -1) {
      local[index] = updatedRecord;
    } else {
      local.unshift(updatedRecord);
    }
    this.saveLocalCheckIns(local);

    return {
      success: true,
      checkIn: updatedRecord,
      message: `${updatedRecord.guest_name} checked out. Duration: ${durationMinutes} mins.`
    };
  }

  async checkOutByMemberId(memberId: string): Promise<{ success: boolean; message: string }> {
    const active = await this.getCheckIns('all', true, undefined, { memberId, status: 'active' });
    if (active.length === 0) {
      return { success: false, message: 'Member is not currently checked in.' };
    }
    const res = await this.checkOutMember(active[0].id);
    return { success: res.success, message: res.message };
  }

  async getAttendanceAnalytics(
    scopeId: string, 
    isProperty: boolean = false, 
    limitToOutletIds?: string[]
  ) {
    const all = await this.getCheckIns(scopeId, isProperty, limitToOutletIds);
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM

    const todayRecords = all.filter(c => c.check_in_time.startsWith(todayStr));
    const monthlyRecords = all.filter(c => c.check_in_time.startsWith(currentMonthStr));
    const activeNow = all.filter(c => c.status === 'active');

    // Dynamic Peak Hours calculation based on check-in time & facility stay duration
    const hourCounts: { [hour: number]: number } = {};
    all.forEach(c => {
      const startTime = new Date(c.check_in_time);
      if (isNaN(startTime.getTime())) return;

      const startHour = startTime.getHours();
      let endHour = startHour;

      if (c.check_out_time) {
        const endTime = new Date(c.check_out_time);
        if (!isNaN(endTime.getTime())) {
          endHour = endTime.getHours();
        }
      } else if (c.status === 'active') {
        endHour = new Date().getHours();
      }

      // Increment counts for all hours during which member was present in facility
      for (let h = startHour; h <= Math.min(23, Math.max(startHour, endHour)); h++) {
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      }
    });

    let peakHour = -1;
    let maxCount = 0;
    Object.entries(hourCounts).forEach(([hr, cnt]) => {
      if (cnt > maxCount) {
        maxCount = cnt;
        peakHour = parseInt(hr, 10);
      }
    });

    // Average duration
    const completedRecords = all.filter(c => c.status === 'completed' && c.duration_minutes);
    const totalMins = completedRecords.reduce((acc, c) => acc + (c.duration_minutes || 0), 0);
    const avgDurationMins = completedRecords.length > 0 ? Math.round(totalMins / completedRecords.length) : 0;

    // Daily breakdown for current month
    const daysInMonthMap: { [day: string]: number } = {};
    monthlyRecords.forEach(c => {
      const day = c.check_in_time.split('T')[0];
      daysInMonthMap[day] = (daysInMonthMap[day] || 0) + 1;
    });

    // Format peak hour dynamically based on actual occupancy logs
    let peakHourFormatted = 'No Check-Ins Yet';
    if (peakHour !== -1 && maxCount > 0) {
      const formatHr = (h: number) => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayHr = h % 12 === 0 ? 12 : h % 12;
        return `${displayHr}:00 ${ampm}`;
      };
      const nextHr = (peakHour + 1) % 24;
      peakHourFormatted = `${formatHr(peakHour)} - ${formatHr(nextHr)}`;
    }

    return {
      activeNowCount: activeNow.length,
      todayTotal: todayRecords.length,
      monthlyTotal: monthlyRecords.length,
      avgDurationMins,
      peakHourFormatted,
      daysInMonthMap,
      hourCounts
    };
  }

  /**
   * Generates Apple Wallet Pass Payload & PKPASS download mock
   */
  generateAppleWalletPayload(member: Member, outletName?: string) {
    return {
      formatVersion: 1,
      passTypeIdentifier: 'pass.com.healthclub.membership',
      serialNumber: member.membership_number || member.id,
      teamIdentifier: 'HC99823412',
      webServiceURL: 'https://api.healthclub.com/passes/',
      authenticationToken: 'auth_' + member.id,
      organizationName: outletName || 'Health Club & Spa',
      description: 'Digital Membership Access Pass',
      logoText: outletName || 'HEALTH CLUB MEMBER',
      foregroundColor: 'rgb(255, 255, 255)',
      backgroundColor: 'rgb(15, 23, 42)', // Dark Slate
      labelColor: 'rgb(148, 163, 184)',
      storeCard: {
        headerFields: [
          {
            key: 'status',
            label: 'STATUS',
            value: member.status?.toUpperCase() || 'ACTIVE'
          }
        ],
        primaryFields: [
          {
            key: 'guestName',
            label: 'MEMBER NAME',
            value: member.guest_name
          }
        ],
        secondaryFields: [
          {
            key: 'memberNo',
            label: 'MEMBERSHIP #',
            value: member.membership_number
          },
          {
            key: 'access',
            label: 'ACCESS',
            value: member.access_type || 'Pool & Spa'
          }
        ],
        auxiliaryFields: [
          {
            key: 'validUntil',
            label: 'VALID UNTIL',
            value: member.current_end_date || 'N/A'
          }
        ],
        backFields: [
          {
            key: 'terms',
            label: 'TERMS & CONDITIONS',
            value: 'This digital membership card is personal and non-transferable. Present card at entry scanning kiosk.'
          },
          {
            key: 'contact',
            label: 'FACILITY INQUIRIES',
            value: 'Please visit reception desk for membership renewals or assistance.'
          }
        ]
      },
      barcode: {
        message: member.membership_number,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
        altText: member.membership_number
      },
      barcodes: [
        {
          message: member.membership_number,
          format: 'PKBarcodeFormatQR',
          messageEncoding: 'iso-8859-1',
          altText: member.membership_number
        },
        {
          message: member.membership_number,
          format: 'PKBarcodeFormatCode128',
          messageEncoding: 'iso-8859-1',
          altText: member.membership_number
        }
      ]
    };
  }

  /**
   * Generates Google Wallet Save Pass URL & JSON payload
   */
  generateGoogleWalletPayload(member: Member, outletName?: string) {
    const classId = `health_club_membership_class_${member.outlet_id || 'main'}`;
    const objectId = `health_club_pass_${member.membership_number || member.id}`;
    
    return {
      iss: 'healthclub-wallet-service@api.com',
      aud: 'google',
      typ: 'savetogooglepay',
      iat: Math.floor(Date.now() / 1000),
      payload: {
        genericObjects: [
          {
            id: objectId,
            classId: classId,
            logo: {
              sourceUri: {
                description: 'Logo',
                uri: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=200'
              }
            },
            cardTitle: {
              defaultValue: {
                language: 'en',
                value: outletName || 'HEALTH CLUB MEMBER PASS'
              }
            },
            header: {
              defaultValue: {
                language: 'en',
                value: member.guest_name
              }
            },
            subheader: {
              defaultValue: {
                language: 'en',
                value: `ID: ${member.membership_number}`
              }
            },
            hexBackgroundColor: '#0f172a',
            barcode: {
              type: 'QR_CODE',
              value: member.membership_number,
              alternateText: member.membership_number
            },
            textModulesData: [
              {
                id: 'status',
                header: 'STATUS',
                body: member.status || 'Active'
              },
              {
                id: 'access',
                header: 'ACCESS FACILITY',
                body: member.access_type || 'Pool & Spa'
              },
              {
                id: 'expiry',
                header: 'EXPIRY DATE',
                body: member.current_end_date || 'Active'
              }
            ]
          }
        ]
      }
    };
  }
}

export const checkInService = new CheckInService();
